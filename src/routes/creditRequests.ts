import { FastifyInstance, FastifyRequest } from 'fastify'
import prisma from '../lib/prisma.js'
import { getUserContext, optionalAuth, requireRole, verifyToken } from '../middleware/auth.js'
import { canAccessCreditRequest, canAccessFarmer, isReadOnlyInstitutionUser } from '../middleware/ownership.js'
import {
  asObject,
  parseFiniteNumber,
  parsePositiveNumber,
  parseTrimmedString,
} from '../lib/validation.js'

export default async function creditRequestsRoutes(fastify: FastifyInstance) {

  fastify.post('/v1/credit-requests', { preHandler: verifyToken }, async (request, reply) => {
    const payload = asObject(request.body)
    if (!payload) return reply.status(400).send({ error: 'Invalid payload' })

    const farmerId = parseTrimmedString(payload.farmerId)
    const montant = parsePositiveNumber(payload.montant)
    const duree = parsePositiveNumber(payload.duree)
    const objet = parseTrimmedString(payload.objet)

    if (!farmerId) return reply.status(400).send({ error: 'Invalid farmerId' })
    if (montant === null) return reply.status(400).send({ error: 'Invalid montant' })
    if (duree === null || duree > 120) return reply.status(400).send({ error: 'Invalid duree' })
    if (!objet) return reply.status(400).send({ error: 'Invalid objet' })
    if (payload.message !== undefined && typeof payload.message !== 'string') {
      return reply.status(400).send({ error: 'Invalid message' })
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })
    if (!['FARMER', 'COOP_ADMIN', 'SUPERADMIN'].includes(context.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const canAccess = await canAccessFarmer(context, farmerId)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const req = await prisma.creditRequest.create({
      data: {
        farmerId,
        montant,
        duree,
        objet,
        message: typeof payload.message === 'string' ? payload.message : undefined,
      }
    })

    return reply.status(201).send(req)
  })

  fastify.get('/v1/credit-requests', { preHandler: optionalAuth }, async (request, reply) => {
    const { farmerId } = request.query as { farmerId?: string }
    const where: any = {}
    if (farmerId) where.farmerId = farmerId

    const context = await getUserContext(request)
    if (context) {
      if (context.role === 'FARMER') {
        where.farmerId = context.farmerId ?? '__none__'
      } else if (context.role === 'COOP_ADMIN') {
        where.farmer = { cooperativeId: context.cooperativeId ?? '__none__' }
      } else if (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') {
        where.farmer = { cooperative: { institutionId: context.institutionId ?? '__none__' } }
      }
    }

    const requests = await prisma.creditRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return requests
  })

  // PATCH /v1/credit-requests/:id/approve
  fastify.patch(
    '/v1/credit-requests/:id/approve',
    { preHandler: requireRole('INSTITUTION_ADMIN', 'MFI_AGENT', 'SUPERADMIN') },
    async (request, reply) => {
    const { id } = request.params as { id: string }
    const payload = asObject(request.body)
    if (!payload) return reply.status(400).send({ error: 'Invalid payload' })

    const montant = payload.montant === undefined ? undefined : parseFiniteNumber(payload.montant)
    const taux = payload.taux === undefined ? undefined : parseFiniteNumber(payload.taux)
    const duree = payload.duree === undefined ? undefined : parseFiniteNumber(payload.duree)
    const motif = payload.motif === undefined ? undefined : parseTrimmedString(payload.motif)
    const institutionId =
      payload.institutionId === undefined ? undefined : parseTrimmedString(payload.institutionId)

    if (payload.montant !== undefined && montant === null) {
      return reply.status(400).send({ error: 'Invalid montant' })
    }
    if (payload.taux !== undefined && taux === null) {
      return reply.status(400).send({ error: 'Invalid taux' })
    }
    if (payload.duree !== undefined && (duree === null || duree <= 0 || duree > 120)) {
      return reply.status(400).send({ error: 'Invalid duree' })
    }
    if (payload.motif !== undefined && motif === null) {
      return reply.status(400).send({ error: 'Invalid motif' })
    }
    if (payload.institutionId !== undefined && !institutionId) {
      return reply.status(400).send({ error: 'Invalid institutionId' })
    }

    try {
      const context = await getUserContext(request)
      if (!context) return reply.status(401).send({ error: 'Unauthorized' })
      if (isReadOnlyInstitutionUser(context)) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const canAccess = await canAccessCreditRequest(context, id)
      if (canAccess === null) return reply.status(404).send({ error: 'Credit request not found' })
      if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

      const updated = await prisma.creditRequest.update({
        where: { id },
        data: {
          statut: 'APPROUVE',
          montantAccorde: montant ?? null,
          taux: taux ?? null,
          dureeAccordee: duree ?? null,
          motif: motif ?? null,
        }
      })

      // Create a CreditDecision record if institutionId provided
      const decisionInstitutionId = context.role === 'SUPERADMIN'
        ? institutionId ?? await getInstitutionIdFromRequest(request)
        : context.institutionId

      if (decisionInstitutionId) {
        await prisma.creditDecision.create({
          data: {
            institutionId: decisionInstitutionId,
            farmerId: updated.farmerId,
            montant,
            taux,
            duree,
            statut: 'APPROUVE',
            motif: motif ?? null,
          }
        })
      }

      return reply.send({ success: true, creditRequest: updated })
    } catch (error) {
      console.error('Approve error:', error)
      return reply.status(500).send({ error: 'Failed to approve credit request' })
    }
    }
  )

  // PATCH /v1/credit-requests/:id/reject
  fastify.patch(
    '/v1/credit-requests/:id/reject',
    { preHandler: requireRole('INSTITUTION_ADMIN', 'MFI_AGENT', 'SUPERADMIN') },
    async (request, reply) => {
    const { id } = request.params as { id: string }
    const payload = asObject(request.body)
    if (!payload) return reply.status(400).send({ error: 'Invalid payload' })

    const motif = payload.motif === undefined ? undefined : parseTrimmedString(payload.motif)
    if (payload.motif !== undefined && motif === null) {
      return reply.status(400).send({ error: 'Invalid motif' })
    }

    try {
      const context = await getUserContext(request)
      if (!context) return reply.status(401).send({ error: 'Unauthorized' })
      if (isReadOnlyInstitutionUser(context)) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const canAccess = await canAccessCreditRequest(context, id)
      if (canAccess === null) return reply.status(404).send({ error: 'Credit request not found' })
      if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

      const updated = await prisma.creditRequest.update({
        where: { id },
        data: {
          statut: 'REJETE',
          motif: motif ?? null,
        }
      })

      return reply.send({ success: true, creditRequest: updated })
    } catch (error) {
      console.error('Reject error:', error)
      return reply.status(500).send({ error: 'Failed to reject credit request' })
    }
    }
  )
}

// Resolve institutionId from the authenticated user's JWT (if present)
async function getInstitutionIdFromRequest(request: FastifyRequest): Promise<string | null> {
  try {
    const context = await getUserContext(request)
    return context?.institutionId ?? null
  } catch {
    return null
  }
}
