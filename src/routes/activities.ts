import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { getUserContext, verifyToken } from '../middleware/auth.js'
import { canAccessFarmer, isReadOnlyInstitutionUser } from '../middleware/ownership.js'
import { asObject, parseTrimmedString } from '../lib/validation.js'

export default async function activitiesRoutes(fastify: FastifyInstance) {
  // POST /v1/activities
  fastify.post('/v1/activities', { preHandler: verifyToken }, async (request, reply) => {
    const body = asObject(request.body)
    if (!body) return reply.status(400).send({ error: 'Invalid payload' })

    const farmerId = parseTrimmedString(body.farmerId)
    const type = parseTrimmedString(body.type)
    const dateValue = parseTrimmedString(body.date)
    const statut = body.statut === undefined ? 'EN_COURS' : parseTrimmedString(body.statut)
    const parcelleId = body.parcelleId === undefined ? undefined : parseTrimmedString(body.parcelleId)
    const description = body.description === undefined ? undefined : parseTrimmedString(body.description)

    if (!farmerId) return reply.status(400).send({ error: 'Invalid farmerId' })
    if (!type) return reply.status(400).send({ error: 'Invalid type' })
    if (!dateValue || Number.isNaN(new Date(dateValue).getTime())) {
      return reply.status(400).send({ error: 'Invalid date' })
    }
    if (body.statut !== undefined && !statut) {
      return reply.status(400).send({ error: 'Invalid statut' })
    }
    if (body.parcelleId !== undefined && !parcelleId) {
      return reply.status(400).send({ error: 'Invalid parcelleId' })
    }
    if (body.description !== undefined && description === null) {
      return reply.status(400).send({ error: 'Invalid description' })
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })
    if (!['FARMER', 'COOP_ADMIN', 'INSTITUTION_ADMIN', 'MFI_AGENT', 'SUPERADMIN'].includes(context.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    if (isReadOnlyInstitutionUser(context)) return reply.status(403).send({ error: 'Forbidden' })

    const canAccess = await canAccessFarmer(context, farmerId)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    if (parcelleId) {
      const parcelle = await prisma.parcelle.findUnique({
        where: { id: parcelleId },
        select: { farmerId: true },
      })

      if (!parcelle) return reply.status(404).send({ error: 'Parcelle not found' })
      if (parcelle.farmerId !== farmerId) return reply.status(403).send({ error: 'Forbidden' })
    }

    const activity = await prisma.activity.create({
      data: {
        farmerId,
        parcelleId: parcelleId ?? null,
        type,
        description: description ?? null,
        date: new Date(dateValue),
        statut: statut ?? 'EN_COURS',
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
