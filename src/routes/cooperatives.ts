import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { getAuthUser, getUserContext, optionalAuth, verifyToken } from '../middleware/auth.js'
import { canAccessCooperative } from '../middleware/ownership.js'
import { asObject, hasDefinedValue, hasForbiddenKey } from '../lib/validation.js'

export default async function cooperativesRoutes(fastify: FastifyInstance) {
  // GET /v1/cooperatives
  fastify.get('/v1/cooperatives', { preHandler: optionalAuth }, async (request, reply) => {
    const { page = '1', limit = '20' } = request.query as {
      page?: string
      limit?: string
    }

    const pageNum = Math.max(1, parseInt(page))
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * pageSize

    const where: any = {}
    const context = await getUserContext(request)

    if (context) {
      if (context.role === 'COOP_ADMIN') {
        where.id = context.cooperativeId ?? '__none__'
      } else if (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') {
        where.institutionId = context.institutionId ?? '__none__'
      } else if (context.role === 'FARMER') {
        const farmer = context.farmerId
          ? await prisma.farmer.findUnique({
              where: { id: context.farmerId },
              select: { cooperativeId: true },
            })
          : null

        where.id = farmer?.cooperativeId ?? '__none__'
      }
    }

    const [data, total] = await Promise.all([
      prisma.cooperative.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
      prisma.cooperative.count({ where }),
    ])

    return { data, total, page: pageNum, pageSize }
  })

  // POST /v1/cooperatives
  fastify.post('/v1/cooperatives', { preHandler: verifyToken }, async (request, reply) => {
    const body = request.body as {
      name: string
      rccm?: string
      region?: string
      filiere?: string
      surface?: number
      foundedAt?: string
      lat?: number
      lng?: number
      blockchainId?: string
    }

    const caller = getAuthUser(request)
    if (!body.name) return reply.status(400).send({ error: 'name is required' })

    const cooperative = await prisma.cooperative.create({
      data: {
        id: `coop-${Date.now()}`,
        name: body.name,
        rccm: body.rccm ?? '',
        region: body.region ?? '',
        filiere: body.filiere ?? '',
        surface: body.surface ? Number(body.surface) : 0,
        foundedAt: body.foundedAt ? new Date(body.foundedAt) : new Date(),
        lat: body.lat ?? 0,
        lng: body.lng ?? 0,
        ...(caller?.id && { adminUserId: caller.id }),
      },
    })

    return reply.status(201).send(cooperative)
  })

  // GET /v1/cooperatives/:id
  fastify.get('/v1/cooperatives/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const cooperative = await prisma.cooperative.findUnique({
      where: { id },
      include: {
        _count: { select: { farmers: true } },
        iotNode: true,
        institution: true,
      },
    })

    if (!cooperative) return reply.status(404).send({ error: 'Cooperative not found' })

    const { _count, ...rest } = cooperative
    return { ...rest, membersCount: _count.farmers }
  })

  // PATCH /v1/cooperatives/:id
  fastify.patch('/v1/cooperatives/:id', { preHandler: verifyToken }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = asObject(request.body)
    if (!body || !hasDefinedValue(body)) {
      return reply.status(400).send({ error: 'Invalid payload' })
    }

    if (hasForbiddenKey(body, ['id', 'adminUserId', 'createdAt', 'updatedAt'])) {
      return reply.status(400).send({ error: 'Invalid payload' })
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessCooperative(context, id)
    if (canAccess === null) return reply.status(404).send({ error: 'Cooperative not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const updated = await prisma.cooperative.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.region && { region: body.region }),
        ...(body.filiere && { filiere: body.filiere }),
        ...(body.surface != null && { surface: body.surface }),
        ...(body.rccm && { rccm: body.rccm }),
        ...(body.logoUrl && { logoUrl: body.logoUrl }),
        ...(body.institutionId !== undefined && { institutionId: body.institutionId }),
      },
    })

    return updated
  })
}
