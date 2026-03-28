import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

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
  fastify.post('/v1/institutions', async (request, reply) => {
    const body = request.body as {
      name: string
      type: string
      country?: string
      logo?: string
      modules?: string[]
      plan?: string
    }

    const institution = await prisma.institution.create({
      data: {
        name: body.name,
        type: body.type,
        country: body.country ?? 'CI',
        logo: body.logo,
        modules: body.modules ?? [],
        plan: body.plan ?? 'STANDARD',
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
  fastify.post('/v1/institutions/:id/decisions', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      farmerId: string
      montant?: number
      taux?: number
      duree?: number
      statut: string
      motif?: string
      notes?: string
    }

    const decision = await prisma.creditDecision.create({
      data: {
        institutionId: id,
        farmerId: body.farmerId,
        montant: body.montant,
        taux: body.taux,
        duree: body.duree,
        statut: body.statut,
        motif: body.motif,
        notes: body.notes,
      }
    })

    return reply.status(201).send(decision)
  })

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
  fastify.patch('/v1/institutions/decisions/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      montant?: number
      taux?: number
      duree?: number
      statut?: string
      motif?: string
      notes?: string
    }

    const decision = await prisma.creditDecision.update({
      where: { id },
      data: {
        ...(body.montant !== undefined && { montant: body.montant }),
        ...(body.taux !== undefined && { taux: body.taux }),
        ...(body.duree !== undefined && { duree: body.duree }),
        ...(body.statut !== undefined && { statut: body.statut }),
        ...(body.motif !== undefined && { motif: body.motif }),
        ...(body.notes !== undefined && { notes: body.notes }),
      }
    })

    return decision
  })

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
  fastify.patch('/v1/institutions/:id/scoring-config', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      weightC1?: number
      weightC2?: number
      weightC3?: number
      weightC4?: number
      c1Rules?: object
      c2Rules?: object
      c3Rules?: object
      c4Rules?: object
      products?: object
      creditConditions?: object
      riskProfile?: object
    }

    const config = await prisma.institutionScoringConfig.upsert({
      where: { institutionId: id },
      update: {
        ...(body.weightC1 !== undefined && { weightC1: body.weightC1 }),
        ...(body.weightC2 !== undefined && { weightC2: body.weightC2 }),
        ...(body.weightC3 !== undefined && { weightC3: body.weightC3 }),
        ...(body.weightC4 !== undefined && { weightC4: body.weightC4 }),
        ...(body.c1Rules !== undefined && { c1Rules: body.c1Rules }),
        ...(body.c2Rules !== undefined && { c2Rules: body.c2Rules }),
        ...(body.c3Rules !== undefined && { c3Rules: body.c3Rules }),
        ...(body.c4Rules !== undefined && { c4Rules: body.c4Rules }),
        ...(body.products !== undefined && { products: body.products }),
        ...(body.creditConditions !== undefined && { creditConditions: body.creditConditions }),
        ...(body.riskProfile !== undefined && { riskProfile: body.riskProfile }),
      },
      create: {
        institutionId: id,
        weightC1: body.weightC1 ?? 30,
        weightC2: body.weightC2 ?? 25,
        weightC3: body.weightC3 ?? 25,
        weightC4: body.weightC4 ?? 20,
        c1Rules: body.c1Rules,
        c2Rules: body.c2Rules,
        c3Rules: body.c3Rules,
        c4Rules: body.c4Rules,
        products: body.products,
        creditConditions: body.creditConditions,
        riskProfile: body.riskProfile,
      }
    })

    return config
  })
}
