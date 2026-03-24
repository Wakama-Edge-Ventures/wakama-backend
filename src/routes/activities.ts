import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function activitiesRoutes(fastify: FastifyInstance) {
  // POST /v1/activities
  fastify.post('/v1/activities', async (request, reply) => {
    const body = request.body as {
      farmerId: string
      parcelleId?: string
      type: string
      description?: string
      date: string
      statut: string
    }

    if (!body.farmerId || !body.type) {
      return reply.status(400).send({ error: 'farmerId and type required' })
    }

    const activity = await prisma.activity.create({
      data: {
        farmerId: body.farmerId,
        parcelleId: body.parcelleId ?? null,
        type: body.type,
        description: body.description ?? null,
        date: new Date(body.date),
        statut: body.statut ?? 'EN_COURS',
      },
    })

    return reply.status(201).send(activity)
  })

  // GET /v1/activities?farmerId=xxx
  fastify.get('/v1/activities', async (request, reply) => {
    const { farmerId, parcelleId } = request.query as {
      farmerId?: string
      parcelleId?: string
    }

    const where: any = {}
    if (farmerId) where.farmerId = farmerId
    if (parcelleId) where.parcelleId = parcelleId

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 20,
      include: { parcelle: { select: { name: true } } },
    })

    return activities
  })
}
