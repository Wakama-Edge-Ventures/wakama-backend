import prisma from '../prisma.js'
import { buildSourceDisclosure } from '../sourceDisclosure.js'

export type NdviAnomalyLevel = 'NONE' | 'WATCH' | 'WARNING' | 'CRITICAL' | 'UNKNOWN'

export interface NdviTrend {
  avgNdvi: number | null
  minNdvi: number | null
  maxNdvi: number | null
  latestNdvi: number | null
  dropPercent: number | null
  anomalyLevel: NdviAnomalyLevel
}

function resolveRowsSource(rows: Array<{ source: string; provider: string }>) {
  if (!rows.length) return { source: 'UNAVAILABLE', provider: 'COPERNICUS_PENDING', confidence: 'LOW' }

  if (rows.some((row) => row.source === 'LIVE')) {
    return { source: 'LIVE', provider: rows.find((row) => row.source === 'LIVE')?.provider ?? 'COPERNICUS', confidence: 'HIGH' }
  }

  if (rows.some((row) => row.source === 'SEED_DEMO')) {
    return { source: 'SEED_DEMO', provider: rows.find((row) => row.source === 'SEED_DEMO')?.provider ?? 'COPERNICUS_PENDING', confidence: 'MEDIUM' }
  }

  return {
    source: rows[0].source,
    provider: rows[0].provider,
    confidence: 'MEDIUM',
  }
}

export function computeNdviTrend(rows: Array<{ ndviValue: number; capturedAt: Date }>): NdviTrend {
  if (!rows.length) {
    return {
      avgNdvi: null,
      minNdvi: null,
      maxNdvi: null,
      latestNdvi: null,
      dropPercent: null,
      anomalyLevel: 'UNKNOWN',
    }
  }

  const sorted = [...rows].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())
  const values = sorted.map((row) => row.ndviValue)

  const avgNdvi = Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
  const minNdvi = Number(Math.min(...values).toFixed(4))
  const maxNdvi = Number(Math.max(...values).toFixed(4))
  const latestNdvi = Number(values[values.length - 1].toFixed(4))

  let dropPercent: number | null = null
  if (maxNdvi > 0) {
    dropPercent = Number((((maxNdvi - latestNdvi) / maxNdvi) * 100).toFixed(2))
  }

  let anomalyLevel: NdviAnomalyLevel = 'UNKNOWN'
  if (dropPercent === null) {
    anomalyLevel = 'UNKNOWN'
  } else if (dropPercent < 10) {
    anomalyLevel = 'NONE'
  } else if (dropPercent < 20) {
    anomalyLevel = 'WATCH'
  } else if (dropPercent < 35) {
    anomalyLevel = 'WARNING'
  } else {
    anomalyLevel = 'CRITICAL'
  }

  return {
    avgNdvi,
    minNdvi,
    maxNdvi,
    latestNdvi,
    dropPercent,
    anomalyLevel,
  }
}

export async function getNdviHistoryForParcelle(parcelleId: string) {
  const rows = await prisma.ndviHistory.findMany({
    where: { parcelleId },
    orderBy: { capturedAt: 'asc' },
  })

  if (!rows.length) {
    return {
      status: 'UNAVAILABLE' as const,
      source: 'UNAVAILABLE' as const,
      provider: 'COPERNICUS_PENDING' as const,
      warning: 'NDVI history not available yet for this parcel/point',
      rows: [],
      trend: computeNdviTrend([]),
      sourceDisclosure: buildSourceDisclosure({
        source: 'UNAVAILABLE',
        provider: 'COPERNICUS_PENDING',
        confidence: 'LOW',
      }),
    }
  }

  const sourceMeta = resolveRowsSource(rows)

  return {
    status: 'OK' as const,
    source: sourceMeta.source,
    provider: sourceMeta.provider,
    rows,
    trend: computeNdviTrend(rows),
    warnings: [],
    sourceDisclosure: buildSourceDisclosure(sourceMeta),
  }
}

export async function getNdviHistoryForPoint(input: {
  lat: number
  lng: number
  startDate: string
  endDate: string
}) {
  const latMin = input.lat - 0.01
  const latMax = input.lat + 0.01
  const lngMin = input.lng - 0.01
  const lngMax = input.lng + 0.01

  const startDate = new Date(`${input.startDate}T00:00:00.000Z`)
  const endDate = new Date(`${input.endDate}T23:59:59.999Z`)

  const rows = await prisma.ndviHistory.findMany({
    where: {
      lat: { gte: latMin, lte: latMax },
      lng: { gte: lngMin, lte: lngMax },
      capturedAt: { gte: startDate, lte: endDate },
    },
    orderBy: { capturedAt: 'asc' },
  })

  if (!rows.length) {
    return {
      status: 'UNAVAILABLE' as const,
      source: 'UNAVAILABLE' as const,
      provider: 'COPERNICUS_PENDING' as const,
      warning: 'NDVI history not available yet for this parcel/point',
      rows: [],
      trend: computeNdviTrend([]),
      sourceDisclosure: buildSourceDisclosure({
        source: 'UNAVAILABLE',
        provider: 'COPERNICUS_PENDING',
        confidence: 'LOW',
      }),
    }
  }

  const sourceMeta = resolveRowsSource(rows)

  return {
    status: 'OK' as const,
    source: sourceMeta.source,
    provider: sourceMeta.provider,
    rows,
    trend: computeNdviTrend(rows),
    warnings: [],
    sourceDisclosure: buildSourceDisclosure(sourceMeta),
  }
}
