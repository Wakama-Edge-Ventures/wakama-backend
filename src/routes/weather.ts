import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function weatherRoutes(fastify: FastifyInstance) {
  // GET /v1/weather/history/:parcelleId
  fastify.get('/v1/weather/history/:parcelleId', async (request, reply) => {
    const { parcelleId } = request.params as { parcelleId: string }
    const { days = '7' } = request.query as { days?: string }

    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)

    const records = await prisma.weatherHistory.findMany({
      where: {
        parcelleId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'desc' },
    })

    return records
  })

  // GET /v1/weather/history/farmer/:farmerId
  fastify.get('/v1/weather/history/farmer/:farmerId', async (request, reply) => {
    const { farmerId } = request.params as { farmerId: string }
    const { days = '7' } = request.query as { days?: string }

    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)

    const records = await prisma.weatherHistory.findMany({
      where: {
        farmerId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'desc' },
    })

    return records
  })
}
