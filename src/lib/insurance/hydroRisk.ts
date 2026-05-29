import prisma from '../prisma.js'
import { buildSourceDisclosure, type SourceDisclosure } from '../sourceDisclosure.js'

export type HydroRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'

export interface HydroRiskPointRef {
  id: string
  name: string
  lat: number
  lng: number
  distanceKm: number
  source: string | null
  confidence: string | null
}

export interface HydroRiskResult {
  hydroRiskLevel: HydroRiskLevel
  nearestDam: HydroRiskPointRef | null
  nearestRiver: HydroRiskPointRef | null
  floodZoneMatches: Array<{
    id: string
    name: string
    distanceKm: number
    riskLevel: string | null
    source: string | null
    confidence: string | null
  }>
  reasons: string[]
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  warnings: string[]
  sourceDisclosure: SourceDisclosure
}

export interface CalculateHydroRiskOptions {
  radiusKm?: number
  rainfallAnomalyPercent?: number | null
  elevationM?: number | null
  weatherSource?: string | null
}

const EARTH_RADIUS_KM = 6371

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((EARTH_RADIUS_KM * c).toFixed(3))
}

function averagePoint(points: Array<[number, number]>): { lat: number; lng: number } | null {
  if (!points.length) return null

  let latSum = 0
  let lngSum = 0
  for (const [lng, lat] of points) {
    latSum += lat
    lngSum += lng
  }

  return {
    lat: latSum / points.length,
    lng: lngSum / points.length,
  }
}

function extractGeoPoint(geometryGeojson?: string | null): { lat: number; lng: number } | null {
  if (!geometryGeojson) return null

  try {
    const parsed = JSON.parse(geometryGeojson)

    if (parsed?.type === 'Point' && Array.isArray(parsed.coordinates) && parsed.coordinates.length >= 2) {
      return { lng: Number(parsed.coordinates[0]), lat: Number(parsed.coordinates[1]) }
    }

    if (
      parsed?.type === 'Feature' &&
      parsed.geometry?.type === 'Point' &&
      Array.isArray(parsed.geometry.coordinates)
    ) {
      return { lng: Number(parsed.geometry.coordinates[0]), lat: Number(parsed.geometry.coordinates[1]) }
    }

    const polygonCoordinates: unknown =
      parsed?.type === 'Polygon'
        ? parsed.coordinates?.[0]
        : parsed?.type === 'Feature' && parsed.geometry?.type === 'Polygon'
          ? parsed.geometry.coordinates?.[0]
          : null

    if (Array.isArray(polygonCoordinates)) {
      const points: Array<[number, number]> = polygonCoordinates
        .map((coord) => (Array.isArray(coord) && coord.length >= 2 ? [Number(coord[0]), Number(coord[1])] : null))
        .filter((coord): coord is [number, number] =>
          Boolean(coord && Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
        )

      return averagePoint(points)
    }
  } catch {
    return null
  }

  return null
}

export async function getNearestDam(lat: number, lng: number): Promise<HydroRiskPointRef | null> {
  const dams = await prisma.moroccoDam.findMany({
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      sourceType: true,
      confidence: true,
    },
  })

  if (!dams.length) return null

  let nearest = dams[0]
  let minDistance = haversineKm(lat, lng, nearest.lat, nearest.lng)

  for (let i = 1; i < dams.length; i++) {
    const candidate = dams[i]
    const distance = haversineKm(lat, lng, candidate.lat, candidate.lng)
    if (distance < minDistance) {
      minDistance = distance
      nearest = candidate
    }
  }

  return {
    id: nearest.id,
    name: nearest.name,
    lat: nearest.lat,
    lng: nearest.lng,
    distanceKm: minDistance,
    source: nearest.sourceType ?? null,
    confidence: nearest.confidence ?? null,
  }
}

export async function getNearestRiverSegment(lat: number, lng: number): Promise<HydroRiskPointRef | null> {
  const segments = await prisma.moroccoRiverSegment.findMany({
    where: {
      lat: { not: null },
      lng: { not: null },
    },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      sourceType: true,
      confidence: true,
    },
  })

  if (!segments.length) return null

  let nearest = segments[0]
  let minDistance = haversineKm(lat, lng, Number(nearest.lat), Number(nearest.lng))

  for (let i = 1; i < segments.length; i++) {
    const candidate = segments[i]
    const distance = haversineKm(lat, lng, Number(candidate.lat), Number(candidate.lng))
    if (distance < minDistance) {
      minDistance = distance
      nearest = candidate
    }
  }

  return {
    id: nearest.id,
    name: nearest.name,
    lat: Number(nearest.lat),
    lng: Number(nearest.lng),
    distanceKm: minDistance,
    source: nearest.sourceType ?? null,
    confidence: nearest.confidence ?? null,
  }
}

export async function getNearbyFloodRiskZones(lat: number, lng: number, radiusKm = 25) {
  const zones = await prisma.moroccoFloodRiskZone.findMany({
    select: {
      id: true,
      name: true,
      geometryGeojson: true,
      riskLevel: true,
      sourceType: true,
      confidence: true,
    },
  })

  const matches = zones
    .map((zone) => {
      const point = extractGeoPoint(zone.geometryGeojson)
      if (!point) return null

      return {
        id: zone.id,
        name: zone.name,
        distanceKm: haversineKm(lat, lng, point.lat, point.lng),
        riskLevel: zone.riskLevel ?? null,
        source: zone.sourceType ?? null,
        confidence: zone.confidence ?? null,
      }
    })
    .filter(
      (
        zone
      ): zone is {
        id: string
        name: string
        distanceKm: number
        riskLevel: string | null
        source: string | null
        confidence: string | null
      } => Boolean(zone)
    )
    .filter((zone) => zone.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)

  return matches
}

function scoreToRiskLevel(score: number): HydroRiskLevel {
  if (score >= 75) return 'CRITICAL'
  if (score >= 50) return 'HIGH'
  if (score >= 25) return 'MEDIUM'
  if (score > 0) return 'LOW'
  return 'UNKNOWN'
}

export async function calculateHydroRisk(
  lat: number,
  lng: number,
  options?: CalculateHydroRiskOptions
): Promise<HydroRiskResult> {
  const radiusKm = options?.radiusKm ?? 25
  const reasons: string[] = []
  const warnings: string[] = []

  const [nearestDam, nearestRiver, floodZoneMatches, nearbyMoroccoRiskZones] = await Promise.all([
    getNearestDam(lat, lng),
    getNearestRiverSegment(lat, lng),
    getNearbyFloodRiskZones(lat, lng, radiusKm),
    prisma.moroccoRiskZone.findMany({
      where: {
        riskType: 'FLOOD',
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        code: true,
        lat: true,
        lng: true,
        radiusKm: true,
        severityDefault: true,
      },
    }),
  ])

  let score = 0

  if (!nearestDam) {
    warnings.push('No Morocco dam reference points were found for hydro assessment')
  } else if (nearestDam.distanceKm <= 5) {
    score += 28
    reasons.push(`Dam proximity under 5km (${nearestDam.name}, ${nearestDam.distanceKm}km) increases technical hydro exposure`)
  } else if (nearestDam.distanceKm <= 15) {
    score += 16
    reasons.push(`Dam proximity under 15km (${nearestDam.name}, ${nearestDam.distanceKm}km) contributes to technical hydro vigilance`)
  } else {
    score += 6
    reasons.push(`Nearest dam is ${nearestDam.distanceKm}km away (${nearestDam.name}); proximity signal is limited`)
  }

  if (!nearestRiver) {
    warnings.push('No river segment coordinates were available near this point')
  } else if (nearestRiver.distanceKm <= 2) {
    score += 30
    reasons.push(`River segment within 2km (${nearestRiver.name}) raises flood pathway sensitivity`)
  } else if (nearestRiver.distanceKm <= 8) {
    score += 18
    reasons.push(`River segment within 8km (${nearestRiver.name}) indicates medium hydro pressure`)
  } else {
    score += 7
    reasons.push(`Nearest river segment (${nearestRiver.name}) is ${nearestRiver.distanceKm}km away`)
  }

  if (floodZoneMatches.length) {
    const topRisk = floodZoneMatches[0]
    const normalizedLevel = (topRisk.riskLevel ?? 'MEDIUM').toUpperCase()
    const zoneWeight = normalizedLevel === 'HIGH' ? 24 : normalizedLevel === 'CRITICAL' ? 30 : 14
    score += Math.min(35, zoneWeight + floodZoneMatches.length * 4)
    reasons.push(
      `${floodZoneMatches.length} flood risk zone(s) detected within ${radiusKm}km (closest: ${topRisk.name} at ${topRisk.distanceKm}km)`
    )
  } else {
    warnings.push(`No mapped flood risk zone was matched within ${radiusKm}km`)
  }

  let matchedMoroccoRiskZoneCount = 0
  for (const zone of nearbyMoroccoRiskZones) {
    const zoneLat = Number(zone.lat)
    const zoneLng = Number(zone.lng)
    const distance = haversineKm(lat, lng, zoneLat, zoneLng)
    const zoneRadius = zone.radiusKm ?? 0

    if (zoneRadius > 0 && distance <= zoneRadius) {
      matchedMoroccoRiskZoneCount += 1
      score += Math.min(20, Math.max(6, (zone.severityDefault ?? 3) * 4))
      reasons.push(`Point intersects Morocco risk zone ${zone.code} (distance ${distance}km <= radius ${zoneRadius}km)`)
    }
  }

  if (!matchedMoroccoRiskZoneCount) {
    warnings.push('No MoroccoRiskZone radius overlap detected for this point')
  }

  const rainfallAnomalyPercent = options?.rainfallAnomalyPercent
  if (typeof rainfallAnomalyPercent === 'number' && Number.isFinite(rainfallAnomalyPercent)) {
    if (rainfallAnomalyPercent >= 50) {
      score += 15
      reasons.push(`Rainfall anomaly +${rainfallAnomalyPercent.toFixed(1)}% increases near-term flood sensitivity`)
    } else if (rainfallAnomalyPercent >= 20) {
      score += 8
      reasons.push(`Rainfall anomaly +${rainfallAnomalyPercent.toFixed(1)}% slightly raises hydro vigilance`)
    }
  } else {
    warnings.push('Rainfall anomaly signal unavailable; hydro score does not include weather anomaly weighting')
  }

  if (typeof options?.elevationM === 'number' && options.elevationM < 20) {
    score += 10
    reasons.push('Low elevation context (<20m) may increase potential accumulation in heavy rain episodes')
  }

  const hydroRiskLevel = scoreToRiskLevel(score)

  const confidenceSignals = [
    nearestDam ? 1 : 0,
    nearestRiver ? 1 : 0,
    floodZoneMatches.length ? 1 : 0,
    matchedMoroccoRiskZoneCount ? 1 : 0,
    typeof rainfallAnomalyPercent === 'number' ? 1 : 0,
  ].reduce((sum, current) => sum + current, 0)

  const confidence = confidenceSignals >= 4 ? 'HIGH' : confidenceSignals >= 2 ? 'MEDIUM' : 'LOW'

  if (confidence !== 'HIGH') {
    warnings.push('Hydro references are incomplete or partially estimated; confidence is reduced')
  }

  if (nearestDam || nearestRiver || floodZoneMatches.length > 0) {
    reasons.push('Proximity indicators are technical exposure signals only and not final claim or eligibility decisions')
  }

  const primarySource =
    nearestDam?.source ?? nearestRiver?.source ?? floodZoneMatches[0]?.source ?? 'MANUAL_ESTIMATE'

  return {
    hydroRiskLevel,
    nearestDam,
    nearestRiver,
    floodZoneMatches,
    reasons,
    confidence,
    warnings,
    sourceDisclosure: buildSourceDisclosure({
      source: primarySource,
      provider: options?.weatherSource ?? 'MOROCCO_HYDRO_REFERENCE',
      confidence,
    }),
  }
}
