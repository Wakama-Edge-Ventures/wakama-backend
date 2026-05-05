import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { getUserContext, verifyToken } from '../middleware/auth.js'
import {
  canAccessAlert,
  canAccessCooperative,
  canAccessFarmer,
  isReadOnlyInstitutionUser,
} from '../middleware/ownership.js'
import { asObject, parseTrimmedString } from '../lib/validation.js'

export default async function alertsRoutes(fastify: FastifyInstance) {
  // GET /v1/alerts?farmerId=xxx
  fastify.get('/v1/alerts', async (request, reply) => {
    const { farmerId, coopId, unreadOnly } = request.query as {
      farmerId?: string
      coopId?: string
      unreadOnly?: string
    }

    const where: any = {}
    if (farmerId) where.farmerId = farmerId
    if (coopId) where.coopId = coopId
    if (unreadOnly === 'true') where.read = false

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return alerts
  })

  // PATCH /v1/alerts/:id/read
  fastify.patch('/v1/alerts/:id/read', { preHandler: verifyToken }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })
    if (isReadOnlyInstitutionUser(context)) return reply.status(403).send({ error: 'Forbidden' })

    const canAccess = await canAccessAlert(context, id)
    if (canAccess === null) return reply.status(404).send({ error: 'Alert not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const alert = await prisma.alert.update({
      where: { id },
      data: { read: true },
    })
    return alert
  })

  // PATCH /v1/alerts/read-all
  fastify.patch('/v1/alerts/read-all', { preHandler: verifyToken }, async (request, reply) => {
    const body = asObject(request.body)
    if (!body) return reply.status(400).send({ error: 'Invalid payload' })

    const farmerId = body.farmerId === undefined ? undefined : parseTrimmedString(body.farmerId)
    const coopId = body.coopId === undefined ? undefined : parseTrimmedString(body.coopId)
    if (!farmerId && !coopId) return reply.status(400).send({ error: 'Invalid payload' })
    if (body.farmerId !== undefined && !farmerId) return reply.status(400).send({ error: 'Invalid farmerId' })
    if (body.coopId !== undefined && !coopId) return reply.status(400).send({ error: 'Invalid coopId' })

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })
    if (isReadOnlyInstitutionUser(context)) return reply.status(403).send({ error: 'Forbidden' })

    if (farmerId) {
      const canAccessFarmerTarget = await canAccessFarmer(context, farmerId)
      if (canAccessFarmerTarget === null) return reply.status(404).send({ error: 'Farmer not found' })
      if (!canAccessFarmerTarget) return reply.status(403).send({ error: 'Forbidden' })
    }

    if (coopId) {
      const canAccessCoopTarget = await canAccessCooperative(context, coopId)
      if (canAccessCoopTarget === null) return reply.status(404).send({ error: 'Cooperative not found' })
      if (!canAccessCoopTarget) return reply.status(403).send({ error: 'Forbidden' })
    }

    const where: any = {}
    if (farmerId) where.farmerId = farmerId
    if (coopId) where.coopId = coopId

    await prisma.alert.updateMany({
      where: { ...where, read: false },
      data: { read: true },
    })

    return { success: true }
  })
}
