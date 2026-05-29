import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function moroccoRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/morocco/provinces', async () => {
    return prisma.moroccoProvince.findMany({
      orderBy: { name: 'asc' },
    })
  })

  fastify.get('/v1/morocco/communes', async (request) => {
    const { provinceId } = request.query as { provinceId?: string }
    return prisma.moroccoCommune.findMany({
      where: provinceId ? { provinceId } : undefined,
      orderBy: { name: 'asc' },
    })
  })

  fastify.get('/v1/morocco/dams', async () => {
    return prisma.moroccoDam.findMany({
      orderBy: { name: 'asc' },
    })
  })

  fastify.get('/v1/morocco/flood-risk-zones', async () => {
    return prisma.moroccoFloodRiskZone.findMany({
      orderBy: { name: 'asc' },
    })
  })

  fastify.get('/v1/morocco/crop-categories', async () => {
    return prisma.insuranceCropCategory.findMany({
      where: { country: 'MA', active: true },
      orderBy: { code: 'asc' },
    })
  })
}
