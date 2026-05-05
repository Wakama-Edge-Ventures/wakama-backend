import type { AuthJwtPayload, AuthUserContext } from './auth.js'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthJwtPayload
    user: AuthJwtPayload
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    authContext?: AuthUserContext | null
  }
}

export {}
