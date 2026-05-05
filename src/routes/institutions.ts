import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { getUserContext, requireRole } from '../middleware/auth.js'
import type { Prisma } from '../../generated/prisma/index.js'
import { canAccessCreditDecision, canAccessFarmer, isReadOnlyInstitutionUser } from '../middleware/ownership.js'
import { asObject, parseFiniteNumber, parseTrimmedString } from '../lib/validation.js'

export default async function institutionsRoutes(fastify: FastifyInstance) {

  // GET /v1/institutions
  fastify.get('/v1/institutions', async (request, reply) => {
    const institutions = await prisma.institution.findMany({
      orderBy: { name: 'asc' }
    })
    return institutions
  })

  // GET /v1/institutions/:id
  fastify.get('/v1/institutions/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const institution = await prisma.institution.findUnique({ where: { id } })
    if (!institution) return reply.status(404).send({ error: 'Institution not found' })
    return institution
  })

  // POST /v1/institutions
  fastify.post('/v1/institutions', { preHandler: requireRole('SUPERADMIN') }, async (request, reply) => {
    const body = asObject(request.body)
    if (!body) return reply.status(400).send({ error: 'Invalid payload' })

    const name = parseTrimmedString(body.name)
    const type = parseTrimmedString(body.type)
    if (!name) return reply.status(400).send({ error: 'Invalid name' })
    if (!type) return reply.status(400).send({ error: 'Invalid type' })

    const institution = await prisma.institution.create({
      data: {
        name,
        type,
        country: typeof body.country === 'string' ? body.country : 'CI',
        logo: typeof body.logo === 'string' ? body.logo : undefined,
        modules: Array.isArray(body.modules) ? body.modules.filter(item => typeof item === 'string') : [],
        plan: typeof body.plan === 'string' ? body.plan : 'STANDARD',
      }
    })

    return reply.status(201).send(institution)
  })

  // GET /v1/institutions/:id/users
  fastify.get('/v1/institutions/:id/users', async (request, reply) => {
    const { id } = request.params as { id: string }
    const users = await prisma.institutionUser.findMany({
      where: { institutionId: id },
      include: { user: { select: { id: true, email: true, role: true } } }
    })
    return users
  })

  // POST /v1/institutions/:id/decisions
  fastify.post(
    '/v1/institutions/:id/decisions',
    { preHandler: requireRole('INSTITUTION_ADMIN', 'MFI_AGENT', 'SUPERADMIN') },
    async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = asObject(request.body)
    if (!body) return reply.status(400).send({ error: 'Invalid payload' })

    const farmerId = parseTrimmedString(body.farmerId)
    const statut = parseTrimmedString(body.statut)
    const montant = body.montant === undefined ? undefined : parseFiniteNumber(body.montant)
    const taux = body.taux === undefined ? undefined : parseFiniteNumber(body.taux)
    const duree = body.duree === undefined ? undefined : parseFiniteNumber(body.duree)
    const motif = body.motif === undefined ? undefined : parseTrimmedString(body.motif)
    const notes = body.notes === undefined ? undefined : parseTrimmedString(body.notes)

    if (!farmerId) return reply.status(400).send({ error: 'Invalid farmerId' })
    if (!statut) return reply.status(400).send({ error: 'Invalid statut' })
    if (body.montant !== undefined && montant === null) {
      return reply.status(400).send({ error: 'Invalid montant' })
    }
    if (body.taux !== undefined && taux === null) {
      return reply.status(400).send({ error: 'Invalid taux' })
    }
    if (body.duree !== undefined && (duree === null || duree <= 0 || duree > 120)) {
      return reply.status(400).send({ error: 'Invalid duree' })
    }
    if (body.motif !== undefined && motif === null) {
      return reply.status(400).send({ error: 'Invalid motif' })
    }
    if (body.notes !== undefined && notes === null) {
      return reply.status(400).send({ error: 'Invalid notes' })
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })
    if (isReadOnlyInstitutionUser(context)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    if (context.role !== 'SUPERADMIN' && context.institutionId !== id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const canAccess = await canAccessFarmer(context, farmerId)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const decision = await prisma.creditDecision.create({
      data: {
        institutionId: id,
        farmerId,
        montant,
        taux,
        duree,
        statut,
        motif: motif ?? null,
        notes: notes ?? null,
      }
    })

    return reply.status(201).send(decision)
    }
  )

  // GET /v1/institutions/:id/decisions
  fastify.get('/v1/institutions/:id/decisions', async (request, reply) => {
    const { id } = request.params as { id: string }
    const decisions = await prisma.creditDecision.findMany({
      where: { institutionId: id },
      include: {
        farmer: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return decisions
  })

  // PATCH /v1/institutions/decisions/:id
  fastify.patch(
    '/v1/institutions/decisions/:id',
    { preHandler: requireRole('INSTITUTION_ADMIN', 'MFI_AGENT', 'SUPERADMIN') },
    async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = asObject(request.body)
    if (!body) return reply.status(400).send({ error: 'Invalid payload' })

    const montant = body.montant === undefined ? undefined : parseFiniteNumber(body.montant)
    const taux = body.taux === undefined ? undefined : parseFiniteNumber(body.taux)
    const duree = body.duree === undefined ? undefined : parseFiniteNumber(body.duree)
    const statut = body.statut === undefined ? undefined : parseTrimmedString(body.statut)
    const motif = body.motif === undefined ? undefined : parseTrimmedString(body.motif)
    const notes = body.notes === undefined ? undefined : parseTrimmedString(body.notes)

    if (body.montant !== undefined && montant === null) {
      return reply.status(400).send({ error: 'Invalid montant' })
    }
    if (body.taux !== undefined && taux === null) {
      return reply.status(400).send({ error: 'Invalid taux' })
    }
    if (body.duree !== undefined && (duree === null || duree <= 0 || duree > 120)) {
      return reply.status(400).send({ error: 'Invalid duree' })
    }
    if (body.statut !== undefined && statut === null) {
      return reply.status(400).send({ error: 'Invalid statut' })
    }
    if (body.motif !== undefined && motif === null) {
      return reply.status(400).send({ error: 'Invalid motif' })
    }
    if (body.notes !== undefined && notes === null) {
      return reply.status(400).send({ error: 'Invalid notes' })
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })
    if (isReadOnlyInstitutionUser(context)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const canAccess = await canAccessCreditDecision(context, id)
    if (canAccess === null) return reply.status(404).send({ error: 'Credit decision not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const decision = await prisma.creditDecision.update({
      where: { id },
      data: {
        ...(montant !== undefined && { montant }),
        ...(taux !== undefined && { taux }),
        ...(duree !== undefined && { duree }),
        ...(statut !== undefined && { statut }),
        ...(motif !== undefined && { motif }),
        ...(notes !== undefined && { notes }),
      }
    })

    return decision
    }
  )

  // GET /v1/institutions/:id/scoring-config
  fastify.get('/v1/institutions/:id/scoring-config', async (request, reply) => {
    const { id } = request.params as { id: string }

    const config = await prisma.institutionScoringConfig.findUnique({
      where: { institutionId: id }
    })

    if (!config) {
      return {
        institutionId: id,
        weightC1: 30,
        weightC2: 25,
        weightC3: 25,
        weightC4: 20,
        c1Rules: null,
        c2Rules: null,
        c3Rules: null,
        c4Rules: null,
        products: null,
        creditConditions: null,
        riskProfile: null,
      }
    }

    return config
  })

  // PATCH /v1/institutions/:id/scoring-config
  fastify.patch(
    '/v1/institutions/:id/scoring-config',
    { preHandler: requireRole('INSTITUTION_ADMIN', 'SUPERADMIN') },
    async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = asObject(request.body)
    if (!body) return reply.status(400).send({ error: 'Invalid payload' })

    const weightC1 = body.weightC1 === undefined ? undefined : parseFiniteNumber(body.weightC1)
    const weightC2 = body.weightC2 === undefined ? undefined : parseFiniteNumber(body.weightC2)
    const weightC3 = body.weightC3 === undefined ? undefined : parseFiniteNumber(body.weightC3)
    const weightC4 = body.weightC4 === undefined ? undefined : parseFiniteNumber(body.weightC4)
    const c1Rules = body.c1Rules as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined
    const c2Rules = body.c2Rules as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined
    const c3Rules = body.c3Rules as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined
    const c4Rules = body.c4Rules as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined
    const products = body.products as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined
    const creditConditions =
      body.creditConditions as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined
    const riskProfile =
      body.riskProfile as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined

    if (body.weightC1 !== undefined && weightC1 === null) {
      return reply.status(400).send({ error: 'Invalid weightC1' })
    }
    if (body.weightC2 !== undefined && weightC2 === null) {
      return reply.status(400).send({ error: 'Invalid weightC2' })
    }
    if (body.weightC3 !== undefined && weightC3 === null) {
      return reply.status(400).send({ error: 'Invalid weightC3' })
    }
    if (body.weightC4 !== undefined && weightC4 === null) {
      return reply.status(400).send({ error: 'Invalid weightC4' })
    }

    if (
      weightC1 !== undefined &&
      weightC2 !== undefined &&
      weightC3 !== undefined &&
      weightC4 !== undefined
    ) {
      const totalWeight = weightC1 + weightC2 + weightC3 + weightC4
      if (Math.abs(totalWeight - 100) > 0.5) {
        return reply.status(400).send({ error: 'Invalid weights sum' })
      }
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })
    if (isReadOnlyInstitutionUser(context)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    if (context.role !== 'SUPERADMIN' && context.institutionId !== id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const config = await prisma.institutionScoringConfig.upsert({
      where: { institutionId: id },
      update: {
        ...(weightC1 !== undefined && { weightC1 }),
        ...(weightC2 !== undefined && { weightC2 }),
        ...(weightC3 !== undefined && { weightC3 }),
        ...(weightC4 !== undefined && { weightC4 }),
        ...(body.c1Rules !== undefined && { c1Rules }),
        ...(body.c2Rules !== undefined && { c2Rules }),
        ...(body.c3Rules !== undefined && { c3Rules }),
        ...(body.c4Rules !== undefined && { c4Rules }),
        ...(body.products !== undefined && { products }),
        ...(body.creditConditions !== undefined && { creditConditions }),
        ...(body.riskProfile !== undefined && { riskProfile }),
      },
      create: {
        institutionId: id,
        weightC1: weightC1 ?? 30,
        weightC2: weightC2 ?? 25,
        weightC3: weightC3 ?? 25,
        weightC4: weightC4 ?? 20,
        c1Rules,
        c2Rules,
        c3Rules,
        c4Rules,
        products,
        creditConditions,
        riskProfile,
      }
    })

    return config
    }
  )
}
