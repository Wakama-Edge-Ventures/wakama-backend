const DEFAULT_CORS_ALLOWED_ORIGINS = [
  'https://wakama.farm',
  'https://www.wakama.farm',
  'https://farmer.wakama.farm',
  'https://fmi.wakama.farm',
  'https://oracle.wakama.farm',
  'https://api.wakama.farm',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:4000',
]

export const DEFAULT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024

export function getAllowedCorsOrigins(): string[] {
  const extraOrigins = parseCommaSeparatedEnv('CORS_ALLOWED_ORIGINS')
  return Array.from(new Set([...DEFAULT_CORS_ALLOWED_ORIGINS, ...extraOrigins]))
}

export function getUploadMaxBytes(): number {
  return getEnvNumber('UPLOAD_MAX_BYTES', DEFAULT_UPLOAD_MAX_BYTES, {
    min: 1024,
    max: 50 * 1024 * 1024,
  })
}

export function getEnvNumber(
  name: string,
  fallback: number,
  options?: { min?: number; max?: number }
): number {
  const rawValue = process.env[name]
  if (!rawValue) return fallback

  const parsedValue = Number(rawValue)
  if (!Number.isFinite(parsedValue)) return fallback
  if (options?.min !== undefined && parsedValue < options.min) return fallback
  if (options?.max !== undefined && parsedValue > options.max) return fallback

  return parsedValue
}

export function getEnvDurationMs(name: string, fallbackMs: number): number {
  const rawValue = process.env[name]?.trim()
  if (!rawValue) return fallbackMs

  const match = rawValue.match(/^(\d+)(ms|s|m|h)?$/i)
  if (!match) return fallbackMs

  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs

  const unit = (match[2] ?? 'ms').toLowerCase()
  switch (unit) {
    case 'h':
      return amount * 60 * 60 * 1000
    case 'm':
      return amount * 60 * 1000
    case 's':
      return amount * 1000
    default:
      return amount
  }
}

function parseCommaSeparatedEnv(name: string): string[] {
  const rawValue = process.env[name]
  if (!rawValue) return []

  return rawValue
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
}
