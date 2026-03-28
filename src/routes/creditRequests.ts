import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

export default async function creditRequestsRoutes(fastify: FastifyInstance) {

  fastify.post('/v1/credit-requests', async (request, reply) => {
    const body = request.body as {
      farmerId: string
      montant: number
      duree: number
      objet: string
      message?: string
    }

    const req = await prisma.creditRequest.create({
      data: {
        farmerId: body.farmerId,
        montant: body.montant,
        duree: body.duree,
        objet: body.objet,
        message: body.message,
      }
    })

    return reply.status(201).send(req)
  })

  fastify.get('/v1/credit-requests', async (request, reply) => {
    const { farmerId } = request.query as { farmerId?: string }
    const where: any = {}
    if (farmerId) where.farmerId = farmerId

    const requests = await prisma.creditRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return requests
  })

  // PATCH /v1/credit-requests/:id/approve
  fastify.patch('/v1/credit-requests/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      montant?: number
      taux?: number
      duree?: number
      motif?: string
      institutionId?: string
    }

    try {
      const updated = await prisma.creditRequest.update({
        where: { id },
        data: {
          statut: 'APPROUVE',
          montantAccorde: body.montant ?? null,
          taux: body.taux ?? null,
          dureeAccordee: body.duree ?? null,
          motif: body.motif ?? null,
        }
      })

      // Create a CreditDecision record if institutionId provided
      const institutionId = body.institutionId
        ?? await getInstitutionIdFromRequest(request)

      if (institutionId) {
        await prisma.creditDecision.create({
          data: {
            institutionId,
            farmerId: updated.farmerId,
            montant: body.montant,
            taux: body.taux,
            duree: body.duree,
            statut: 'APPROUVE',
            motif: body.motif ?? null,
          }
        })
      }

      return reply.send({ success: true, creditRequest: updated })
    } catch (error) {
      console.error('Approve error:', error)
      return reply.status(500).send({ error: 'Failed to approve credit request' })
    }
  })

  // PATCH /v1/credit-requests/:id/reject
  fastify.patch('/v1/credit-requests/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { motif?: string }

    try {
      const updated = await prisma.creditRequest.update({
        where: { id },
        data: {
          statut: 'REJETE',
          motif: body.motif ?? null,
        }
      })

      return reply.send({ success: true, creditRequest: updated })
    } catch (error) {
      console.error('Reject error:', error)
      return reply.status(500).send({ error: 'Failed to reject credit request' })
    }
  })
}

// Resolve institutionId from the authenticated user's JWT (if present)
async function getInstitutionIdFromRequest(request: any): Promise<string | null> {
  try {
    const userId = (request.user as any)?.id
    if (!userId) return null
    const institutionUser = await prisma.institutionUser.findFirst({
      where: { userId }
    })
    return institutionUser?.institutionId ?? null
  } catch {
    return null
  }
}
