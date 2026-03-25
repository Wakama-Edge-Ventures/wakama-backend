import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function creditRequestsRoutes(fastify: FastifyInstance) {

  fastify.post('/v1/credit-requests', async (request, reply) => {
    const body = request.body as {
      farmerId: string
      montant: number
      duree: number
      objet: string
      message?: string
    }

    const req = await prisma.creditRequest.create({
      data: {
        farmerId: body.farmerId,
        montant: body.montant,
        duree: body.duree,
        objet: body.objet,
        message: body.message,
      }
    })

    return reply.status(201).send(req)
  })

  fastify.get('/v1/credit-requests', async (request, reply) => {
    const { farmerId } = request.query as { farmerId?: string }
    const where: any = {}
    if (farmerId) where.farmerId = farmerId

    const requests = await prisma.creditRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return requests
  })
}
