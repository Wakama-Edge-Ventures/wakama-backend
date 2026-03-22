import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function alertsRoutes(fastify: FastifyInstance) {
  // GET /v1/alerts
  fastify.get('/v1/alerts', async (request, reply) => {
    const { severity, status, farmerId, cooperativeId } = request.query as {
      severity?: string
      status?: string
      farmerId?: string
      cooperativeId?: string
    }

    const where: any = {}
    if (severity) where.severity = severity
    if (status) where.status = status
    if (farmerId) where.farmerId = farmerId
    if (cooperativeId) where.cooperativeId = cooperativeId

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return alerts
  })
}
