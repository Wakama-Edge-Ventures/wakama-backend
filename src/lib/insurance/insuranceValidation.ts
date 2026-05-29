import { parseFiniteNumber, parseTrimmedString } from '../validation.js'

export const MOROCCO_COUNTRY_CODE = 'MA'

const ALLOWED_SOURCE_LABELS = new Set([
  'LIVE',
  'SEED_DEMO',
  'EXCEL_IMPORT',
  'MANUAL_ESTIMATE',
  'MANUAL_ENTRY',
  'UNAVAILABLE',
])

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

type ValidationError = { ok: false; error: string }
type ApplicationValidationSuccess = {
  ok: true
  country: string
  cropCode: string
  farmerId: string | null
  parcelleId: string | null
}
type MissionValidationSuccess = {
  ok: true
  applicationId: string
  missionType: string
  agentUserId: string | null
  scheduledAt: Date | null
  notes: string | null
}
type FieldAuditSyncValidationSuccess = {
  ok: true
  applicationId: string
  missionId: string | null
  agentUserId: string
  capturedAt: Date
  lat: number
  lng: number
  source: string
  accuracyMeters: number | null
  auditHashLocal: string | null
  deviceId: string | null
  photos: unknown[]
  answersJson: unknown
  offlineCreatedAt: Date | null
}

export function validateSourceLabel(value: unknown): { ok: true; source: string } | { ok: false; error: string } {
  const source = parseTrimmedString(value)
  if (!source) {
    return { ok: false, error: 'Invalid source label' }
  }

  if (!ALLOWED_SOURCE_LABELS.has(source)) {
    return {
      ok: false,
      error: 'Unsupported source label. Use LIVE, SEED_DEMO, EXCEL_IMPORT, MANUAL_ESTIMATE, MANUAL_ENTRY, or UNAVAILABLE',
    }
  }

  return { ok: true, source }
}

export function validateCountryMorocco(value: unknown): { ok: true; country: string } | { ok: false; error: string } {
  const country = parseTrimmedString(value)?.toUpperCase()
  if (!country) return { ok: false, error: 'country is required' }
  if (country !== MOROCCO_COUNTRY_CODE) {
    return { ok: false, error: 'country must be MA for Morocco insurance routes' }
  }

  return { ok: true, country }
}

export function validateLatLng(lat: unknown, lng: unknown): { ok: true; lat: number; lng: number } | { ok: false; error: string } {
  const parsedLat = parseFiniteNumber(lat)
  const parsedLng = parseFiniteNumber(lng)

  if (parsedLat === null || parsedLng === null) {
    return { ok: false, error: 'lat and lng must be finite numbers' }
  }

  if (parsedLat < -90 || parsedLat > 90) {
    return { ok: false, error: 'lat must be in [-90, 90]' }
  }

  if (parsedLng < -180 || parsedLng > 180) {
    return { ok: false, error: 'lng must be in [-180, 180]' }
  }

  return { ok: true, lat: parsedLat, lng: parsedLng }
}

export function validateDateRange(
  startDate: unknown,
  endDate: unknown,
  maxRangeDays = 366
): { ok: true; startDate: Date; endDate: Date } | { ok: false; error: string } {
  const start = parseDate(startDate)
  const end = parseDate(endDate)

  if (!start || !end) {
    return { ok: false, error: 'startDate and endDate must be valid ISO dates' }
  }

  if (start > end) {
    return { ok: false, error: 'startDate must be before or equal to endDate' }
  }

  const dayMs = 24 * 60 * 60 * 1000
  const rangeDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1

  if (rangeDays > maxRangeDays) {
    return { ok: false, error: `Date range too large. Max ${maxRangeDays} days` }
  }

  return { ok: true, startDate: start, endDate: end }
}

export function validateCropCode(value: unknown): { ok: true; cropCode: string } | { ok: false; error: string } {
  const cropCode = parseTrimmedString(value)?.toUpperCase()
  if (!cropCode) return { ok: false, error: 'cropCode is required' }
  if (cropCode.length > 64) return { ok: false, error: 'cropCode too long' }
  return { ok: true, cropCode }
}

export function validateApplicationPayload(payload: Record<string, unknown>): ApplicationValidationSuccess | ValidationError {
  const country = validateCountryMorocco(payload.country)
  if ('error' in country) return country

  const cropCode = validateCropCode(payload.cropCode)
  if ('error' in cropCode) return cropCode

  const farmerId = parseTrimmedString(payload.farmerId)
  const parcelleId = parseTrimmedString(payload.parcelleId)

  const hasCoordinates = payload.lat !== undefined || payload.lng !== undefined
  if (!farmerId && !parcelleId && !hasCoordinates) {
    return {
      ok: false as const,
      error: 'Provide farmerId, parcelleId, or lat/lng for technical pre-application',
    }
  }

  if (hasCoordinates) {
    const coords = validateLatLng(payload.lat, payload.lng)
    if ('error' in coords) return coords
  }

  if (payload.source !== undefined) {
    const source = validateSourceLabel(payload.source)
    if ('error' in source) return source
  }

  return {
    ok: true,
    country: country.country,
    cropCode: cropCode.cropCode,
    farmerId,
    parcelleId,
  }
}

export function validateMissionPayload(payload: Record<string, unknown>): MissionValidationSuccess | ValidationError {
  const applicationId = parseTrimmedString(payload.applicationId)
  const missionType = parseTrimmedString(payload.missionType)

  if (!applicationId) return { ok: false as const, error: 'applicationId is required' }
  if (!missionType) return { ok: false as const, error: 'missionType is required' }

  const allowedTypes = new Set(['FIELD_AUDIT', 'CLAIM_INSPECTION', 'PARCEL_VERIFICATION'])
  if (!allowedTypes.has(missionType)) {
    return { ok: false as const, error: 'missionType is invalid' }
  }

  const agentUserId = parseTrimmedString(payload.agentUserId)
  const scheduledAt = payload.scheduledAt === undefined ? null : parseDate(payload.scheduledAt)
  if (payload.scheduledAt !== undefined && !scheduledAt) {
    return { ok: false as const, error: 'scheduledAt must be a valid date' }
  }

  if (payload.source !== undefined) {
    const source = validateSourceLabel(payload.source)
    if ('error' in source) return source
  }

  return {
    ok: true,
    applicationId,
    missionType,
    agentUserId,
    scheduledAt,
    notes: parseTrimmedString(payload.notes),
  }
}

export function validateFieldAuditSyncPayload(payload: Record<string, unknown>): FieldAuditSyncValidationSuccess | ValidationError {
  const applicationId = parseTrimmedString(payload.applicationId)
  const missionId = parseTrimmedString(payload.missionId)
  const agentUserId = parseTrimmedString(payload.agentUserId)

  if (!applicationId) return { ok: false as const, error: 'applicationId is required' }
  if (!agentUserId) return { ok: false as const, error: 'agentUserId is required' }

  const coordinates = validateLatLng(payload.lat, payload.lng)
  if ('error' in coordinates) return coordinates

  const capturedAt = parseDate(payload.capturedAt)
  if (!capturedAt) {
    return { ok: false as const, error: 'capturedAt must be a valid ISO date' }
  }

  const source = validateSourceLabel(payload.source)
  if ('error' in source) return source

  const answersJson = payload.answersJson
  if (!answersJson || typeof answersJson !== 'object' || Array.isArray(answersJson)) {
    return { ok: false as const, error: 'answersJson must be an object' }
  }

  const photos = payload.photos
  if (photos !== undefined && !Array.isArray(photos)) {
    return { ok: false as const, error: 'photos must be an array when provided' }
  }

  const accuracyMeters = payload.accuracyMeters === undefined ? null : parseFiniteNumber(payload.accuracyMeters)
  if (payload.accuracyMeters !== undefined && accuracyMeters === null) {
    return { ok: false as const, error: 'accuracyMeters must be a finite number' }
  }

  const offlineCreatedAt = payload.offlineCreatedAt === undefined ? null : parseDate(payload.offlineCreatedAt)
  if (payload.offlineCreatedAt !== undefined && !offlineCreatedAt) {
    return { ok: false as const, error: 'offlineCreatedAt must be a valid ISO date' }
  }

  return {
    ok: true,
    applicationId,
    missionId,
    agentUserId,
    capturedAt,
    lat: coordinates.lat,
    lng: coordinates.lng,
    source: source.source,
    accuracyMeters,
    auditHashLocal: parseTrimmedString(payload.auditHashLocal),
    deviceId: parseTrimmedString(payload.deviceId),
    photos: Array.isArray(photos) ? photos : [],
    answersJson,
    offlineCreatedAt,
  }
}
