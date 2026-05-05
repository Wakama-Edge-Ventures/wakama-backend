import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { getUserContext, verifyToken } from '../middleware/auth.js'
import { canAccessFarmer, canAccessParcelle } from '../middleware/ownership.js'
import {
  asObject,
  hasDefinedValue,
  isValidJsonString,
  parseFiniteNumber,
  parsePositiveNumber,
  parseTrimmedString,
} from '../lib/validation.js'

const VALID_STADES = new Set(['PREPARATION', 'SEMIS', 'CROISSANCE', 'FLORAISON', 'RECOLTE', 'POST_RECOLTE'])

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
  fastify.post('/v1/parcelles', { preHandler: verifyToken }, async (request, reply) => {
    const payload = asObject(request.body)
    if (!payload) return reply.status(400).send({ error: 'Invalid payload' })

    const farmerId = parseTrimmedString(payload.farmerId)
    const name = parseTrimmedString(payload.name)
    const culture = parseTrimmedString(payload.culture)
    const superficie = parsePositiveNumber(payload.superficie)
    const lat = parseFiniteNumber(payload.lat)
    const lng = parseFiniteNumber(payload.lng)
    const ndvi = payload.ndvi === undefined ? undefined : parseFiniteNumber(payload.ndvi)

    if (!farmerId) return reply.status(400).send({ error: 'Invalid farmerId' })
    if (!name) return reply.status(400).send({ error: 'Invalid name' })
    if (!culture) return reply.status(400).send({ error: 'Invalid culture' })
    if (superficie === null) return reply.status(400).send({ error: 'Invalid superficie' })
    if (lat === null) return reply.status(400).send({ error: 'Invalid lat' })
    if (lng === null) return reply.status(400).send({ error: 'Invalid lng' })
    if (payload.polygone !== undefined && !isValidJsonString(payload.polygone)) {
      return reply.status(400).send({ error: 'Invalid polygone' })
    }
    if (payload.ndvi !== undefined && ndvi === null) {
      return reply.status(400).send({ error: 'Invalid ndvi' })
    }

    const stade = payload.stade === undefined ? undefined : parseTrimmedString(payload.stade)
    if (payload.stade !== undefined && (stade === null || !VALID_STADES.has(stade!))) {
      return reply.status(400).send({ error: 'Invalid stade' })
    }

    const historique = payload.historique === undefined ? undefined : parseTrimmedString(payload.historique)
    if (payload.historique !== undefined && historique === null) {
      return reply.status(400).send({ error: 'Invalid historique' })
    }

    let datePlantation: Date | undefined
    if (payload.datePlantation !== undefined) {
      const d = new Date(payload.datePlantation as string)
      if (isNaN(d.getTime())) return reply.status(400).send({ error: 'Invalid datePlantation' })
      datePlantation = d
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })
    if (!['FARMER', 'COOP_ADMIN', 'SUPERADMIN'].includes(context.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const canAccess = await canAccessFarmer(context, farmerId)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const parcelle = await prisma.parcelle.create({
      data: {
        farmerId,
        name,
        culture,
        superficie,
        lat,
        lng,
        polygone: typeof payload.polygone === 'string' ? payload.polygone : null,
        ndvi: ndvi ?? 0,
        statut: 'active',
        ...(stade !== undefined && { stade }),
        ...(datePlantation !== undefined && { datePlantation }),
        ...(historique !== undefined && { historique }),
      },
    })

    return reply.status(201).send(parcelle)
  })

  // PATCH /v1/parcelles/:id
  fastify.patch('/v1/parcelles/:id', { preHandler: verifyToken }, async (request, reply) => {
    const { id } = request.params as { id: string }
    console.log('PATCH_PARCELLE_BODY', JSON.stringify(request.body))
    const payload = asObject(request.body)
    if (!payload || !hasDefinedValue(payload)) {
      return reply.status(400).send({ error: 'Invalid payload' })
    }

    const superficie = payload.superficie === undefined ? undefined : parsePositiveNumber(payload.superficie)
    const lat = payload.lat === undefined ? undefined : parseFiniteNumber(payload.lat)
    const lng = payload.lng === undefined ? undefined : parseFiniteNumber(payload.lng)
    const ndvi = payload.ndvi === undefined ? undefined : parseFiniteNumber(payload.ndvi)
    const name = payload.name === undefined ? undefined : parseTrimmedString(payload.name)
    const culture = payload.culture === undefined ? undefined : parseTrimmedString(payload.culture)
    const statut = payload.statut === undefined ? undefined : parseTrimmedString(payload.statut)

    if (payload.name !== undefined && name === null) return reply.status(400).send({ error: 'Invalid name' })
    if (payload.culture !== undefined && culture === null) {
      return reply.status(400).send({ error: 'Invalid culture' })
    }
    if (payload.superficie !== undefined && superficie === null) {
      return reply.status(400).send({ error: 'Invalid superficie' })
    }
    if (payload.lat !== undefined && lat === null) return reply.status(400).send({ error: 'Invalid lat' })
    if (payload.lng !== undefined && lng === null) return reply.status(400).send({ error: 'Invalid lng' })
    if (payload.polygone !== undefined && !isValidJsonString(payload.polygone)) {
      return reply.status(400).send({ error: 'Invalid polygone' })
    }
    if (payload.ndvi !== undefined && ndvi === null) return reply.status(400).send({ error: 'Invalid ndvi' })
    if (payload.statut !== undefined && statut === null) {
      return reply.status(400).send({ error: 'Invalid statut' })
    }

    const stade = payload.stade === undefined ? undefined : parseTrimmedString(payload.stade)
    if (payload.stade !== undefined && (stade === null || !VALID_STADES.has(stade!))) {
      return reply.status(400).send({ error: 'Invalid stade' })
    }

    const historique = payload.historique === undefined ? undefined : parseTrimmedString(payload.historique)
    if (payload.historique !== undefined && historique === null) {
      return reply.status(400).send({ error: 'Invalid historique' })
    }

    let datePlantation: Date | undefined
    if (payload.datePlantation !== undefined) {
      const d = new Date(payload.datePlantation as string)
      if (isNaN(d.getTime())) return reply.status(400).send({ error: 'Invalid datePlantation' })
      datePlantation = d
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessParcelle(context, id)
    if (canAccess === null) return reply.status(404).send({ error: 'Parcelle not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const updateData = {
      ...(name !== undefined && { name }),
      ...(culture !== undefined && { culture }),
      ...(superficie !== undefined && { superficie }),
      ...(lat !== undefined && { lat }),
      ...(lng !== undefined && { lng }),
      ...(payload.polygone !== undefined && { polygone: payload.polygone as string }),
      ...(ndvi !== undefined && { ndvi }),
      ...(statut !== undefined && { statut }),
      ...(stade !== undefined && { stade }),
      ...(datePlantation !== undefined && { datePlantation }),
      ...(historique !== undefined && { historique }),
    }
    console.log('PATCH_PARCELLE_DATA', JSON.stringify(updateData))

    const updated = await prisma.parcelle.update({ where: { id }, data: updateData })
    console.log('PATCH_PARCELLE_RESULT', JSON.stringify(updated))

    return updated
  })

  // DELETE /v1/parcelles/:id
  fastify.delete('/v1/parcelles/:id', { preHandler: verifyToken }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessParcelle(context, id)
    if (canAccess === null) return reply.status(404).send({ error: 'Parcelle not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    await prisma.parcelle.delete({ where: { id } })
    return reply.status(204).send()
  })
}
