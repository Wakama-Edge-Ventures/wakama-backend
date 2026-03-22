import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function cooperativesRoutes(fastify: FastifyInstance) {
  // GET /v1/cooperatives
  fastify.get('/v1/cooperatives', async (request, reply) => {
    const { page = '1', limit = '20' } = request.query as {
      page?: string
      limit?: string
    }

    const pageNum = Math.max(1, parseInt(page))
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * pageSize

    const [data, total] = await Promise.all([
      prisma.cooperative.findMany({ skip, take: pageSize, orderBy: { name: 'asc' } }),
      prisma.cooperative.count(),
    ])

    return { data, total, page: pageNum, pageSize }
  })

  // GET /v1/cooperatives/:id
  fastify.get('/v1/cooperatives/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const cooperative = await prisma.cooperative.findUnique({
      where: { id },
      include: { _count: { select: { farmers: true } } },
    })

    if (!cooperative) return reply.status(404).send({ error: 'Cooperative not found' })

    const { _count, ...rest } = cooperative
    return { ...rest, membersCount: _count.farmers }
  })
}
