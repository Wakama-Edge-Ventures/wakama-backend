import { FastifyReply, FastifyRequest } from 'fastify'
import { getEnvDurationMs, getEnvNumber } from '../lib/security.js'

type RateLimitBucket = {
  count: number
  resetAt: number
}

type RateLimitOptions = {
  keyPrefix: string
  max: number
  windowMs: number
  skip?: (request: FastifyRequest) => boolean
}

const buckets = new Map<string, RateLimitBucket>()

export function createRateLimitPreHandler(options: RateLimitOptions) {
  return async function rateLimitPreHandler(request: FastifyRequest, reply: FastifyReply) {
    if (options.skip?.(request)) return

    const key = `${options.keyPrefix}:${getClientKey(request)}`
    const now = Date.now()
    const existing = buckets.get(key)

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs })
      cleanupExpiredBuckets(now)
      return
    }

    existing.count += 1
    if (existing.count > options.max) {
      return reply.status(429).send({ error: 'Too many requests' })
    }
  }
}

export function createGlobalRateLimit() {
  return createRateLimitPreHandler({
    keyPrefix: 'global',
    max: getEnvNumber('RATE_LIMIT_MAX', 300, { min: 1, max: 10000 }),
    windowMs: getEnvDurationMs('RATE_LIMIT_WINDOW', 60 * 1000),
    skip: request =>
      request.method === 'OPTIONS' ||
      request.url === '/health' ||
      request.url.startsWith('/uploads/'),
  })
}

export function createAuthRateLimit() {
  return createRateLimitPreHandler({
    keyPrefix: 'auth',
    max: getEnvNumber('AUTH_RATE_LIMIT_MAX', 10, { min: 1, max: 1000 }),
    windowMs: getEnvDurationMs('RATE_LIMIT_WINDOW', 60 * 1000),
  })
}

export function createUploadRateLimit() {
  return createRateLimitPreHandler({
    keyPrefix: 'upload',
    max: getEnvNumber('UPLOAD_RATE_LIMIT_MAX', 20, { min: 1, max: 1000 }),
    windowMs: getEnvDurationMs('RATE_LIMIT_WINDOW', 60 * 1000),
  })
}

export function createIotRateLimit() {
  return createRateLimitPreHandler({
    keyPrefix: 'iot',
    max: getEnvNumber('IOT_RATE_LIMIT_MAX', 600, { min: 1, max: 20000 }),
    windowMs: getEnvDurationMs('RATE_LIMIT_WINDOW', 60 * 1000),
  })
}

function getClientKey(request: FastifyRequest): string {
  const forwardedFor = request.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }

  return request.ip
}

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < 1000) return

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}
