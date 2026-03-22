import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function parcellesRoutes(fastify: FastifyInstance) {
  // GET /v1/parcelles?farmerId=xxx
  fastify.get('/v1/parcelles', async (request, reply) => {
    const { farmerId } = request.query as { farmerId?: string }
    const where: any = {}
    if (farmerId) where.farmerId = farmerId

    const parcelles = await prisma.parcelle.findMany({ where, orderBy: { lastUpdatedAt: 'desc' } })
    return parcelles
  })

  // POST /v1/parcelles
  fastify.post('/v1/parcelles', async (request, reply) => {
    const body = request.body as {
      farmerId: string
      name: string
      culture: string
      superficie: number
      lat: number
      lng: number
      polygone?: string
      ndvi?: number
    }

    const parcelle = await prisma.parcelle.create({
      data: {
        farmerId: body.farmerId,
        name: body.name,
        culture: body.culture,
        superficie: body.superficie,
        lat: body.lat,
        lng: body.lng,
        polygone: body.polygone ?? null,
        ndvi: body.ndvi ?? 0,
        statut: 'active',
      },
    })

    return reply.status(201).send(parcelle)
  })

  // PATCH /v1/parcelles/:id
  fastify.patch('/v1/parcelles/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      culture?: string
      superficie?: number
      lat?: number
      lng?: number
      polygone?: string
      ndvi?: number
      statut?: string
    }

    const existing = await prisma.parcelle.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Parcelle not found' })

    const updated = await prisma.parcelle.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.culture && { culture: body.culture }),
        ...(body.superficie != null && { superficie: body.superficie }),
        ...(body.lat != null && { lat: body.lat }),
        ...(body.lng != null && { lng: body.lng }),
        ...(body.polygone !== undefined && { polygone: body.polygone }),
        ...(body.ndvi != null && { ndvi: body.ndvi }),
        ...(body.statut && { statut: body.statut }),
      },
    })

    return updated
  })

  // DELETE /v1/parcelles/:id
  fastify.delete('/v1/parcelles/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.parcelle.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Parcelle not found' })

    await prisma.parcelle.delete({ where: { id } })
    return reply.status(204).send()
  })
}
