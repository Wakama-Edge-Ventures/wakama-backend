import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'

// Valid device keys (in production, store in DB)
const VALID_DEVICE_KEYS: Record<string, string> = {
  'etra_esp32_001__K2v9F6pQxW3dR8nH1sL4aT7yU0iO5pB': 'coop-etra-001',
}

export default async function iotRoutes(fastify: FastifyInstance) {
  // POST /v1/iot/ingest — receive data from ESP32
  fastify.post('/v1/iot/ingest', async (request, reply) => {
    const deviceKey = request.headers['x-device-key'] as string

    if (!deviceKey || !VALID_DEVICE_KEYS[deviceKey]) {
      return reply.status(401).send({ error: 'Invalid device key' })
    }

    const coopId = VALID_DEVICE_KEYS[deviceKey]

    const body = request.body as {
      team: string
      site: string
      subteam: string
      device: string
      ts: number
      ntp_synced: boolean
      ok: boolean
      rssi: number
      sensors: {
        temp_true_ok: boolean
        temp_true_c: number
        soil_pct: number
        soil_raw: number
        soil_v: number
        air_temp_c_s1?: number
        air_humidity_pct_s1?: number
        air_temp_c_s2?: number
        air_humidity_pct_s2_raw?: number
        air_humidity_pct_s2_corr?: number
        air_temp_c_avg?: number
        air_humidity_pct_avg?: number
        air_humidity_pct_used?: number
        air_humidity_diff_pct?: number
      }
    }

    if (!body.sensors) {
      return reply.status(400).send({ error: 'Missing sensors data' })
    }

    const s = body.sensors

    // Find or create IoTNode for this device
    let node = await prisma.ioTNode.findFirst({
      where: { nodeCode: body.device },
    })

    if (!node) {
      node = await prisma.ioTNode.create({
        data: {
          nodeCode: body.device,
          cooperativeId: coopId,
          lat: 7.4882,
          lng: 4.8133,
          status: 'LIVE',
          batterie: 100,
          connectivity: 'WiFi',
          lastSyncAt: new Date(),
        },
      })
    } else {
      await prisma.ioTNode.update({
        where: { id: node.id },
        data: {
          status: 'LIVE',
          lastSyncAt: new Date(),
          lastRssi: body.rssi,
          totalReadings: { increment: 1 },
        },
      })
    }

    // Store IoT reading
    await prisma.ioTReading.create({
      data: {
        nodeId: node.id,
        temperature: s.air_temp_c_avg ?? s.temp_true_c ?? 0,
        humidity: s.air_humidity_pct_used ?? 0,
        soilMoisture: s.soil_pct / 100,
        soilTempTrue: s.temp_true_ok ? s.temp_true_c : null,
        soilRaw: s.soil_raw,
        soilVoltage: s.soil_v,
        tempS1: s.air_temp_c_s1,
        humidityS1: s.air_humidity_pct_s1,
        tempS2: s.air_temp_c_s2,
        humidityS2Raw: s.air_humidity_pct_s2_raw,
        humidityS2Corr: s.air_humidity_pct_s2_corr,
        tempAvg: s.air_temp_c_avg,
        humidityAvg: s.air_humidity_pct_avg,
        humidityUsed: s.air_humidity_pct_used,
        humidityDiff: s.air_humidity_diff_pct,
        rssi: body.rssi,
        deviceCode: body.device,
        ntpSynced: body.ntp_synced,
        recordedAt: body.ntp_synced ? new Date(body.ts * 1000) : new Date(),
      },
    })

    // Also store in WeatherHistory for ML training
    await prisma.weatherHistory.create({
      data: {
        coopId,
        lat: 7.4882,
        lng: 4.8133,
        region: 'Vallée du Bandama',
        country: 'CI',
        tempAir: s.air_temp_c_avg ?? s.temp_true_c ?? 0,
        humidityAir: s.air_humidity_pct_used ?? 0,
        soilMoist0: s.soil_pct / 100,
        tempSoil0: s.temp_true_ok ? s.temp_true_c : null,
      },
    })

    console.log(`[IoT] Received from ${body.device}: T=${s.air_temp_c_avg}°C H=${s.air_humidity_pct_used}% Soil=${s.soil_pct}%`)

    return {
      ok: true,
      nodeId: node.id,
      message: 'Data ingested successfully',
      ts: new Date().toISOString(),
    }
  })

  // GET /v1/iot/node?coopId=xxx — get IoT node for a coop
  fastify.get('/v1/iot/node', async (request, reply) => {
    const { coopId, farmerId } = request.query as {
      coopId?: string
      farmerId?: string
    }

    const where: any = {}
    if (coopId) where.cooperativeId = coopId
    if (farmerId) where.farmerId = farmerId

    const node = await prisma.ioTNode.findFirst({
      where,
      include: {
        readings: {
          orderBy: { recordedAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!node) return reply.status(404).send({ error: 'No IoT node found' })
    return node
  })

  // GET /v1/iot/readings/:nodeId — get last readings
  fastify.get('/v1/iot/readings/:nodeId', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string }
    const { limit = '50' } = request.query as { limit?: string }

    const readings = await prisma.ioTReading.findMany({
      where: { nodeId },
      orderBy: { recordedAt: 'desc' },
      take: parseInt(limit),
    })

    return readings
  })
}
