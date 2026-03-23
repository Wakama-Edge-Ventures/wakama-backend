import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

const SENTINEL_TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
const SENTINEL_PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process'

async function getSentinelToken(): Promise<string> {
  const clientId = process.env.SENTINEL_CLIENT_ID
  const clientSecret = process.env.SENTINEL_CLIENT_SECRET

  const res = await fetch(SENTINEL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId!,
      client_secret: clientSecret!,
    }),
  })

  if (!res.ok) throw new Error('Failed to get Sentinel token')
  const data = await res.json()
  return data.access_token
}

export default async function ndviRoutes(fastify: FastifyInstance) {
  // GET /v1/ndvi/:parcelleId — get NDVI for a specific parcelle
  fastify.get('/v1/ndvi/:parcelleId', async (request, reply) => {
    const { parcelleId } = request.params as { parcelleId: string }

    const parcelle = await prisma.parcelle.findUnique({ where: { id: parcelleId } })

    if (!parcelle) return reply.status(404).send({ error: 'Parcelle not found' })
    if (!parcelle.polygone) {
      return reply.status(400).send({ error: 'No polygon defined for this parcelle' })
    }

    try {
      const token = await getSentinelToken()
      const geo = JSON.parse(parcelle.polygone)

      const evalscript = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08"] }],
    output: { bands: 1, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  return [ndvi];
}`

      let coordinates: number[][]
      if (geo.type === 'Feature') {
        coordinates = geo.geometry.coordinates[0]
      } else if (geo.type === 'Polygon') {
        coordinates = geo.coordinates[0]
      } else {
        return reply.status(400).send({ error: 'Invalid polygon format' })
      }

      const lngs = coordinates.map((c: number[]) => c[0])
      const lats = coordinates.map((c: number[]) => c[1])
      const bbox = [
        Math.min(...lngs), Math.min(...lats),
        Math.max(...lngs), Math.max(...lats),
      ]

      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const to = new Date().toISOString()

      const statsRes = await fetch('https://sh.dataspace.copernicus.eu/api/v1/statistics', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            bounds: {
              bbox,
              properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' },
            },
            data: [{
              dataFilter: {
                timeRange: { from, to },
                mosaickingOrder: 'leastCC',
              },
              type: 'sentinel-2-l2a',
            }],
          },
          aggregation: {
            timeRange: { from, to },
            aggregationInterval: { of: 'P30D' },
            evalscript,
            resx: 10,
            resy: 10,
          },
        }),
      })

      if (!statsRes.ok) {
        const err = await statsRes.text()
        return reply.status(500).send({ error: 'Sentinel API error', details: err })
      }

      const statsData = await statsRes.json()
      const outputs = statsData?.data?.[0]?.outputs?.B0
      const mean = outputs?.stats?.mean ?? null

      if (mean !== null) {
        await prisma.parcelle.update({
          where: { id: parcelleId },
          data: { ndvi: parseFloat(mean.toFixed(3)) },
        })
      }

      return {
        parcelleId,
        ndvi: mean !== null ? parseFloat(mean.toFixed(3)) : null,
        lastUpdated: new Date().toISOString(),
        status: mean !== null ? 'success' : 'no_data',
      }
    } catch (err: any) {
      return reply.status(500).send({ error: 'NDVI calculation failed', message: err.message })
    }
  })

  // GET /v1/ndvi/parcelle/:parcelleId/image — get NDVI image as PNG
  fastify.get('/v1/ndvi/parcelle/:parcelleId/image', async (request, reply) => {
    const { parcelleId } = request.params as { parcelleId: string }

    const parcelle = await prisma.parcelle.findUnique({ where: { id: parcelleId } })

    if (!parcelle?.polygone) {
      return reply.status(400).send({ error: 'No polygon defined' })
    }

    try {
      const token = await getSentinelToken()
      const geo = JSON.parse(parcelle.polygone)

      let coordinates: number[][]
      if (geo.type === 'Feature') {
        coordinates = geo.geometry.coordinates[0]
      } else if (geo.type === 'Polygon') {
        coordinates = geo.coordinates[0]
      } else {
        return reply.status(400).send({ error: 'Invalid polygon format' })
      }

      const lngs = coordinates.map((c: number[]) => c[0])
      const lats = coordinates.map((c: number[]) => c[1])
      const bbox = [
        Math.min(...lngs), Math.min(...lats),
        Math.max(...lngs), Math.max(...lats),
      ]

      const evalscriptColor = `
        //VERSION=3
        function setup() {
          return { input: [{ bands: ["B04", "B08"] }], output: { bands: 3 } };
        }
        function evaluatePixel(sample) {
          let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
          if (ndvi < 0) return [0.5, 0.5, 0.5];
          if (ndvi < 0.2) return [0.9, 0.4, 0.1];
          if (ndvi < 0.4) return [0.9, 0.8, 0.1];
          if (ndvi < 0.6) return [0.4, 0.8, 0.2];
          return [0.1, 0.6, 0.1];
        }
      `

      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const to = new Date().toISOString()

      const imgRes = await fetch(SENTINEL_PROCESS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            bounds: {
              bbox,
              properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' },
            },
            data: [{
              dataFilter: { timeRange: { from, to } },
              type: 'sentinel-2-l2a',
            }],
          },
          output: {
            width: 512,
            height: 512,
            responses: [{ identifier: 'default', format: { type: 'image/png' } }],
          },
          evalscript: evalscriptColor,
        }),
      })

      if (!imgRes.ok) {
        const err = await imgRes.text()
        return reply.status(500).send({ error: 'Image fetch failed', details: err })
      }

      const imgBuffer = await imgRes.arrayBuffer()
      reply.header('Content-Type', 'image/png')
      reply.header('Cache-Control', 'public, max-age=3600')
      return reply.send(Buffer.from(imgBuffer))
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })
}
