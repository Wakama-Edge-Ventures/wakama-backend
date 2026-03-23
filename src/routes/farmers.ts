import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function farmersRoutes(fastify: FastifyInstance) {
  // GET /v1/farmers
  fastify.get('/v1/farmers', async (request, reply) => {
    const { page = '1', limit = '20', search, region, cooperativeId } = request.query as {
      page?: string
      limit?: string
      search?: string
      region?: string
      cooperativeId?: string
    }

    const pageNum = Math.max(1, parseInt(page))
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * pageSize

    const where: any = {}
    if (region) where.region = region
    if (cooperativeId) where.cooperativeId = cooperativeId
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.farmer.findMany({ where, skip, take: pageSize, orderBy: { onboardedAt: 'desc' } }),
      prisma.farmer.count({ where }),
    ])

    return { data, total, page: pageNum, pageSize }
  })

  // GET /v1/farmers/:id
  fastify.get('/v1/farmers/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const farmer = await prisma.farmer.findUnique({
      where: { id },
      include: {
        parcelles: true,
        creditScore: true,
        loans: true,
        alerts: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })

    if (!farmer) return reply.status(404).send({ error: 'Farmer not found' })
    return farmer
  })

  // POST /v1/farmers
  fastify.post('/v1/farmers', async (request, reply) => {
    const body = request.body as {
      firstName: string
      lastName: string
      phone: string
      region: string
      village: string
      lat: number
      lng: number
      surface: number
      cooperativeId?: string
      userId: string
    }

    const farmer = await prisma.farmer.create({
      data: {
        userId: body.userId,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        region: body.region,
        village: body.village,
        lat: body.lat,
        lng: body.lng,
        surface: body.surface,
        cooperativeId: body.cooperativeId ?? null,
      },
    })

    return reply.status(201).send(farmer)
  })

  // PATCH /v1/farmers/:id
  fastify.patch('/v1/farmers/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      firstName?: string
      lastName?: string
      phone?: string
      region?: string
      village?: string
      surface?: number
      photoUrl?: string
      cniUrl?: string
      attestationUrl?: string
      cooperativeId?: string | null
      lat?: number
      lng?: number
    }

    const farmer = await prisma.farmer.findUnique({ where: { id } })
    if (!farmer) return reply.status(404).send({ error: 'Farmer not found' })

    const updated = await prisma.farmer.update({
      where: { id },
      data: {
        ...(body.firstName && { firstName: body.firstName }),
        ...(body.lastName && { lastName: body.lastName }),
        ...(body.phone && { phone: body.phone }),
        ...(body.region && { region: body.region }),
        ...(body.village && { village: body.village }),
        ...(body.surface && { surface: Number(body.surface) }),
        ...(body.photoUrl && { photoUrl: body.photoUrl }),
        ...(body.cniUrl && { cniUrl: body.cniUrl }),
        ...(body.attestationUrl && { attestationUrl: body.attestationUrl }),
        ...(body.cooperativeId !== undefined && { cooperativeId: body.cooperativeId }),
        ...(body.lat !== undefined && { lat: Number(body.lat) }),
        ...(body.lng !== undefined && { lng: Number(body.lng) }),
      }
    })

    return updated
  })
}
