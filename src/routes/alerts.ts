import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

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
  fastify.patch('/v1/alerts/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string }
    const alert = await prisma.alert.update({
      where: { id },
      data: { read: true },
    })
    return alert
  })

  // PATCH /v1/alerts/read-all
  fastify.patch('/v1/alerts/read-all', async (request, reply) => {
    const { farmerId, coopId } = request.body as {
      farmerId?: string
      coopId?: string
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
