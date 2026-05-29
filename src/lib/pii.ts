import type { AuthUserContext } from '../types/auth.js'

export interface SensitivePiiContext {
  role?: AuthUserContext['role'] | string | null
  farmerId?: string | null
  targetFarmerId?: string | null
  institutionId?: string | null
  hasInstitutionContext?: boolean
  fieldAgentOverride?: boolean
}

export function maskMoroccoCin(cin?: string | null): string | null {
  if (!cin) return null

  const normalized = cin.trim().toUpperCase()
  if (normalized.length <= 3) return `${normalized[0] ?? '*'}**`

  const first = normalized.slice(0, 2)
  const last = normalized.slice(-1)
  const stars = '*'.repeat(Math.max(2, normalized.length - 3))
  return `${first}${stars}${last}`
}

export function maskMoroccoPhone(phone?: string | null): string | null {
  if (!phone) return null

  const value = phone.trim()
  if (value.length <= 4) return '*'.repeat(value.length)

  const isIntl = value.startsWith('+212')
  const prefix = isIntl ? '+212' : value.slice(0, 1)
  const suffix = value.slice(-2)
  const maskedLen = Math.max(4, value.length - prefix.length - suffix.length)
  return `${prefix}${'*'.repeat(maskedLen)}${suffix}`
}

export function maskEmail(email?: string | null): string | null {
  if (!email) return null

  const normalized = email.trim().toLowerCase()
  const at = normalized.indexOf('@')
  if (at <= 0 || at === normalized.length - 1) return '***'

  const local = normalized.slice(0, at)
  const domain = normalized.slice(at + 1)
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`

  return `${local[0]}***${local[local.length - 1]}@${domain}`
}

export function canViewSensitivePii(context?: SensitivePiiContext | null): boolean {
  if (!context?.role) return false

  if (context.role === 'SUPERADMIN') return true

  if (context.role === 'INSTITUTION_ADMIN') {
    return !!context.institutionId && context.hasInstitutionContext === true
  }

  if (context.role === 'FARMER') {
    return !!context.farmerId && context.farmerId === context.targetFarmerId
  }

  if (context.role === 'FIELD_AGENT') {
    return context.fieldAgentOverride === true
  }

  return false
}
