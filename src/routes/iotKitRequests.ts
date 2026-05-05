import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { sendIotKitNotification } from '../lib/mailer.js'
import { getUserContext, verifyToken } from '../middleware/auth.js'
import { canAccessCooperative, isReadOnlyInstitutionUser } from '../middleware/ownership.js'
import { asObject, parseFiniteNumber, parseTrimmedString } from '../lib/validation.js'

export default async function iotKitRequestsRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/iot-kit-requests', { preHandler: verifyToken }, async (request, reply) => {
    const body = asObject(request.body)
    if (!body) return reply.status(400).send({ error: 'Invalid payload' })

    const coopName = parseTrimmedString(body.coopName)
    const coopIdFromBody = body.coopId === undefined ? undefined : parseTrimmedString(body.coopId)
    const superficie = body.superficie === undefined ? undefined : parseFiniteNumber(body.superficie)
    const nbMembres = body.nbMembres === undefined ? undefined : parseFiniteNumber(body.nbMembres)
    const culture = body.culture === undefined ? undefined : parseTrimmedString(body.culture)
    const message = body.message === undefined ? undefined : parseTrimmedString(body.message)

    if (!coopName) return reply.status(400).send({ error: 'Invalid coopName' })
    if (body.coopId !== undefined && !coopIdFromBody) return reply.status(400).send({ error: 'Invalid coopId' })
    if (body.superficie !== undefined && (superficie === null || superficie <= 0)) {
      return reply.status(400).send({ error: 'Invalid superficie' })
    }
    if (body.nbMembres !== undefined && (nbMembres === null || nbMembres <= 0)) {
      return reply.status(400).send({ error: 'Invalid nbMembres' })
    }
    if (body.culture !== undefined && culture === null) return reply.status(400).send({ error: 'Invalid culture' })
    if (body.message !== undefined && message === null) return reply.status(400).send({ error: 'Invalid message' })

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })
    if (!['COOP_ADMIN', 'INSTITUTION_ADMIN', 'MFI_AGENT', 'SUPERADMIN'].includes(context.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    if (isReadOnlyInstitutionUser(context)) return reply.status(403).send({ error: 'Forbidden' })

    const coopId =
      context.role === 'COOP_ADMIN'
        ? coopIdFromBody ?? context.cooperativeId ?? undefined
        : coopIdFromBody

    if (context.role !== 'SUPERADMIN') {
      if (!coopId) return reply.status(400).send({ error: 'Invalid coopId' })

      const canAccess = await canAccessCooperative(context, coopId)
      if (canAccess === null) return reply.status(404).send({ error: 'Cooperative not found' })
      if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })
    }

    const req = await prisma.iotKitRequest.create({
      data: {
        coopId: coopId ?? null,
        coopName,
        superficie: superficie ?? undefined,
        culture: culture ?? undefined,
        nbMembres: nbMembres ?? undefined,
        hasElectricite: body.hasElectricite === true,
        hasConnexion: body.hasConnexion === true,
        message: message ?? undefined,
      }
    })

    sendIotKitNotification({
      coopName,
      superficie: superficie ?? undefined,
      culture: culture ?? undefined,
      nbMembres: nbMembres ?? undefined,
      hasElectricite: body.hasElectricite === true,
      hasConnexion: body.hasConnexion === true,
      message: message ?? undefined,
    }).catch(err => console.error('[Mailer] IoT kit failed:', err))

    return reply.status(201).send(req)
  })
}
