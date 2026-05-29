import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { buildSourceDisclosure } from '../lib/sourceDisclosure.js'

function withDisclosure<T extends Record<string, unknown>>(
  row: T,
  sourceKey: keyof T = 'source',
  confidenceKey: keyof T = 'confidence'
) {
  const source = row[sourceKey]
  const confidence = row[confidenceKey]
  return {
    ...row,
    disclosure: buildSourceDisclosure({
      source: typeof source === 'string' ? source : null,
      confidence: typeof confidence === 'string' ? confidence : null,
    }),
  }
}

export default async function moroccoRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/morocco/regions', async () => {
    const rows = await prisma.moroccoRegion.findMany({
      orderBy: { nameFr: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/morocco/provinces', async () => {
    const rows = await prisma.moroccoProvince.findMany({
      orderBy: { name: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/morocco/communes', async (request) => {
    const { provinceId, regionCode } = request.query as { provinceId?: string; regionCode?: string }
    const rows = await prisma.moroccoCommune.findMany({
      where: {
        ...(provinceId ? { provinceId } : {}),
        ...(regionCode ? { regionCode } : {}),
      },
      orderBy: { name: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/morocco/cities', async (request) => {
    const { provinceId, communeId } = request.query as { provinceId?: string; communeId?: string }
    const rows = await prisma.moroccoCity.findMany({
      where: {
        ...(provinceId ? { provinceId } : {}),
        ...(communeId ? { communeId } : {}),
      },
      orderBy: { nameFr: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/morocco/crops', async () => {
    const rows = await prisma.insuranceCropCategory.findMany({
      where: { country: 'MA', active: true },
      orderBy: { code: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/morocco/crop-seasons', async (request) => {
    const { cropCode, regionCode, agroZoneCode } = request.query as {
      cropCode?: string
      regionCode?: string
      agroZoneCode?: string
    }
    const rows = await prisma.moroccoCropSeason.findMany({
      where: {
        ...(cropCode ? { cropCode } : {}),
        ...(regionCode ? { regionCode } : {}),
        ...(agroZoneCode ? { agroZoneCode } : {}),
      },
      orderBy: [{ cropCode: 'asc' }, { regionCode: 'asc' }],
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/morocco/agro-climatic-zones', async () => {
    const rows = await prisma.moroccoAgroClimaticZone.findMany({
      orderBy: { code: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/morocco/risk-zones', async () => {
    const rows = await prisma.moroccoRiskZone.findMany({
      orderBy: { code: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/morocco/dams', async () => {
    const rows = await prisma.moroccoDam.findMany({
      orderBy: { name: 'asc' },
    })
    return rows.map((row) => withDisclosure(row, 'sourceType'))
  })

  fastify.get('/v1/morocco/river-segments', async () => {
    const rows = await prisma.moroccoRiverSegment.findMany({
      orderBy: { name: 'asc' },
    })
    return rows.map((row) => withDisclosure(row, 'sourceType'))
  })

  fastify.get('/v1/morocco/flood-risk-zones', async () => {
    const rows = await prisma.moroccoFloodRiskZone.findMany({
      orderBy: { name: 'asc' },
    })
    return rows.map((row) => withDisclosure(row, 'sourceType'))
  })

  // Backward compatibility alias from Phase 27A.
  fastify.get('/v1/morocco/crop-categories', async () => {
    const rows = await prisma.insuranceCropCategory.findMany({
      where: { country: 'MA', active: true },
      orderBy: { code: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })
}
