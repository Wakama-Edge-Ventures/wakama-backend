import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function messagesRoutes(fastify: FastifyInstance) {
  // POST /v1/messages
  fastify.post('/v1/messages', async (request, reply) => {
    const body = request.body as {
      farmerId: string
      cooperativeId: string
      objet: string
      message: string
    }

    const msg = await prisma.message.create({
      data: {
        farmerId: body.farmerId,
        cooperativeId: body.cooperativeId,
        objet: body.objet,
        message: body.message,
        lu: false,
      },
    })

    return reply.status(201).send(msg)
  })

  // GET /v1/messages?cooperativeId=xxx
  fastify.get('/v1/messages', async (request, reply) => {
    const { cooperativeId, farmerId } = request.query as {
      cooperativeId?: string
      farmerId?: string
    }

    const where: any = {}
    if (cooperativeId) where.cooperativeId = cooperativeId
    if (farmerId) where.farmerId = farmerId

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return messages
  })
}
