import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function scoresRoutes(fastify: FastifyInstance) {
  // GET /v1/scores/:farmerId
  fastify.get('/v1/scores/:farmerId', async (request, reply) => {
    const { farmerId } = request.params as { farmerId: string }

    const score = await prisma.creditScore.findUnique({
      where: { farmerId },
    })

    if (!score) return reply.status(404).send({ error: 'Credit score not found' })
    return score
  })
}
