import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { getUserContext, verifyToken } from '../middleware/auth.js'
import { canAccessCooperative, canAccessFarmer, isReadOnlyInstitutionUser } from '../middleware/ownership.js'
import { asObject, parseTrimmedString } from '../lib/validation.js'

export default async function messagesRoutes(fastify: FastifyInstance) {
  // POST /v1/messages
  fastify.post('/v1/messages', { preHandler: verifyToken }, async (request, reply) => {
    const body = asObject(request.body)
    if (!body) return reply.status(400).send({ error: 'Invalid payload' })

    const farmerId = parseTrimmedString(body.farmerId)
    const cooperativeId = parseTrimmedString(body.cooperativeId)
    const objet = parseTrimmedString(body.objet)
    const message = parseTrimmedString(body.message)

    if (!farmerId) return reply.status(400).send({ error: 'Invalid farmerId' })
    if (!cooperativeId) return reply.status(400).send({ error: 'Invalid cooperativeId' })
    if (!objet) return reply.status(400).send({ error: 'Invalid objet' })
    if (!message) return reply.status(400).send({ error: 'Invalid message' })

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })
    if (!['FARMER', 'COOP_ADMIN', 'INSTITUTION_ADMIN', 'MFI_AGENT', 'SUPERADMIN'].includes(context.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    if (isReadOnlyInstitutionUser(context)) return reply.status(403).send({ error: 'Forbidden' })

    const canAccessFarmerTarget = await canAccessFarmer(context, farmerId)
    if (canAccessFarmerTarget === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccessFarmerTarget) return reply.status(403).send({ error: 'Forbidden' })

    const canAccessCoopTarget = await canAccessCooperative(context, cooperativeId)
    if (canAccessCoopTarget === null) return reply.status(404).send({ error: 'Cooperative not found' })
    if (!canAccessCoopTarget) return reply.status(403).send({ error: 'Forbidden' })

    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
      select: { cooperativeId: true },
    })
    if (!farmer) return reply.status(404).send({ error: 'Farmer not found' })
    if (farmer.cooperativeId !== cooperativeId) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const msg = await prisma.message.create({
      data: {
        farmerId,
        cooperativeId,
        objet,
        message,
        lu: false,
      },
    })

    return reply.status(201).send(msg)
  })

  // GET /v1/messages?cooperativeId=xxx
  fastify.get('/v1/messages', async (request, reply) => {
    const { cooperativeId, farmerId } = request.query as {
      cooperativeId?: string
      farmerId?: string
    }

    const where: any = {}
    if (cooperativeId) where.cooperativeId = cooperativeId
    if (farmerId) where.farmerId = farmerId

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return messages
  })
}
