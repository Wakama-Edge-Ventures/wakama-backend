import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { buildDossierResponse, loadDossierBundle } from '../lib/institutionalScoring.js'
import { getUserContext, optionalAuth, verifyToken } from '../middleware/auth.js'
import { canAccessFarmer } from '../middleware/ownership.js'
import { asObject, hasDefinedValue, hasForbiddenKey } from '../lib/validation.js'

export default async function farmersRoutes(fastify: FastifyInstance) {
  // GET /v1/farmers
  fastify.get('/', { preHandler: optionalAuth }, async (request, reply) => {
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

    const context = await getUserContext(request)
    if (context) {
      if (context.role === 'FARMER') {
        where.id = context.farmerId ?? '__none__'
      } else if (context.role === 'COOP_ADMIN') {
        if (cooperativeId && context.cooperativeId && cooperativeId !== context.cooperativeId) {
          where.id = '__none__'
        } else {
          where.cooperativeId = context.cooperativeId ?? '__none__'
        }
      } else if (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') {
        where.cooperative = { institutionId: context.institutionId ?? '__none__' }
      }
    }

    const [data, total] = await Promise.all([
      prisma.farmer.findMany({ where, skip, take: pageSize, orderBy: { onboardedAt: 'desc' } }),
      prisma.farmer.count({ where }),
    ])

    return { data, total, page: pageNum, pageSize }
  })

  // GET /v1/farmers/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const farmer = await prisma.farmer.findUnique({
      where: { id },
      include: {
        parcelles: true,
        creditScore: true,
        loans: true,
        alerts: { orderBy: { createdAt: 'desc' }, take: 5 },
        cooperative: {
          select: {
            id: true,
            name: true,
            institutionId: true,
            region: true,
            filiere: true,
          },
        },
      },
    })

    if (!farmer) return reply.status(404).send({ error: 'Farmer not found' })
    return farmer
  })

  // GET /v1/farmers/:id/dossier-comite
  fastify.get('/:id/dossier-comite', { preHandler: verifyToken }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessFarmer(context, id)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const bundle = await loadDossierBundle(id, context.institutionId, {
      useCooperativeInstitutionFallback: true,
    })
    return buildDossierResponse(bundle, context)
  })

  // POST /v1/farmers
  fastify.post('/', async (request, reply) => {
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
  fastify.patch('/:id', { preHandler: verifyToken }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = asObject(request.body)
    if (!body || !hasDefinedValue(body)) {
      return reply.status(400).send({ error: 'Invalid payload' })
    }

    if (hasForbiddenKey(body, ['id', 'userId', 'role', 'passwordHash', 'createdAt', 'updatedAt'])) {
      return reply.status(400).send({ error: 'Invalid payload' })
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessFarmer(context, id)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

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
        ...(body.experienceAnnees !== undefined && { experienceAnnees: body.experienceAnnees }),
        ...(body.revenusAnnexes !== undefined && { revenusAnnexes: body.revenusAnnexes }),
        ...(body.historicCredit !== undefined && { historicCredit: body.historicCredit }),
      }
    })

    return updated
  })
}
