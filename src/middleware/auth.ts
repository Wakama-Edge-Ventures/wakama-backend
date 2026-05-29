/// <reference path="../types/fastify-auth.d.ts" />

import { FastifyReply, FastifyRequest } from 'fastify'
import prisma from '../lib/prisma.js'
import type { AuthJwtPayload, AuthRole, AuthUserContext } from '../types/auth.js'

function unauthorized(reply: FastifyReply) {
  return reply.status(401).send({ error: 'Unauthorized' })
}

function forbidden(reply: FastifyReply) {
  return reply.status(403).send({ error: 'Forbidden' })
}

function isAuthJwtPayload(value: unknown): value is AuthJwtPayload {
  if (!value || typeof value !== 'object') return false

  const payload = value as Record<string, unknown>
  return (
    typeof payload.id === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.role === 'string'
  )
}

export function getAuthUser(request: FastifyRequest): AuthJwtPayload | null {
  return isAuthJwtPayload(request.user) ? request.user : null
}

export async function verifyToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return unauthorized(reply)
  }
}

export async function optionalAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.headers.authorization) {
    request.authContext = null
    return
  }
  try {
    await request.jwtVerify()
  } catch {
    request.authContext = null
    return
  }
}

export function requireRole(...roles: AuthRole[]) {
  return async function roleGuard(request: FastifyRequest, reply: FastifyReply) {
    await verifyToken(request, reply)
    if (reply.sent) return

    const authUser = getAuthUser(request)
    if (!authUser) return unauthorized(reply)
    if (!roles.includes(authUser.role)) return forbidden(reply)
  }
}

export async function requireInstitutionUser(request: FastifyRequest, reply: FastifyReply) {
  await verifyToken(request, reply)
  if (reply.sent) return

  const context = await getUserContext(request)
  if (!context?.institutionId) return forbidden(reply)
}

export async function getUserContext(request: FastifyRequest): Promise<AuthUserContext | null> {
  if (request.authContext !== undefined) {
    return request.authContext
  }

  const authUser = getAuthUser(request)
  if (!authUser) {
    request.authContext = null
    return null
  }

  const context: AuthUserContext = {
    userId: authUser.id,
    email: authUser.email,
    role: authUser.role,
    farmerId: null,
    cooperativeId: null,
    institutionId: null,
    institutionRole: null,
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      role: true,
      farmer: { select: { id: true } },
      coopAdmin: { select: { cooperativeId: true } },
      institutionUsers: {
        select: { institutionId: true, role: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })

  if (!user) {
    request.authContext = context
    return context
  }

  context.userId = user.id
  context.email = user.email
  context.role = user.role
  context.farmerId = user.farmer?.id ?? null
  context.cooperativeId = user.coopAdmin?.cooperativeId ?? null

  const institutionUser = user.institutionUsers[0]
  if (institutionUser) {
    context.institutionId = institutionUser.institutionId
    context.institutionRole = institutionUser.role
  }

  if (context.role === 'COOP_ADMIN' && !context.cooperativeId) {
    const cooperative = await prisma.cooperative.findFirst({
      where: { adminUserId: user.id },
      select: { id: true },
    })

    context.cooperativeId = cooperative?.id ?? null
  }

  request.authContext = context
  return context
}
