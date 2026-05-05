import type { Role } from '../../generated/prisma/index.js'

export type AuthRole = Role

export interface AuthJwtPayload {
  id: string
  email: string
  role: AuthRole
}

export interface AuthUserContext {
  userId: string
  email: string
  role: AuthRole
  farmerId: string | null
  cooperativeId: string | null
  institutionId: string | null
  institutionRole: string | null
}
