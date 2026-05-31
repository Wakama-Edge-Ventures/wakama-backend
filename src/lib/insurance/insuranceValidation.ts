import { parseFiniteNumber, parseTrimmedString } from '../validation.js'

export const MOROCCO_COUNTRY_CODE = 'MA'

const ALLOWED_SOURCE_LABELS = new Set([
  'LIVE',
  'SEED_DEMO',
  'EXCEL_IMPORT',
  'MANUAL_ESTIMATE',
  'DEGRADED',
  'MANUAL_ENTRY',
  'UNAVAILABLE',
])

const ALLOWED_FARMER_LANGUAGES = new Set(['DARIJA', 'AR', 'FR', 'EN'])

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

type FarmerDocumentPrepared = {
  type: string
  sourceLabel: string
}

type FarmerClaimHistoryEvent = {
  year: number
  type: string
  crop: string
  estimatedLossMad: number | null
  comment: string | null
  sourceLabel: 'MANUAL_ESTIMATE'
}

type FarmerDeclaredClaimHistory = {
  periodYears: number
  noClaimsDeclared: boolean
  events: FarmerClaimHistoryEvent[]
}

type FarmerDcaValidationSuccess = {
  ok: true
  parcelleId: string
  consentCndp: boolean
  preferredLanguage: string
  documentsPrepared: FarmerDocumentPrepared[]
  declaredClaimHistory: FarmerDeclaredClaimHistory
  source: string
}

export function validateSourceLabel(value: unknown): { ok: true; source: string } | { ok: false; error: string } {
  const source = parseTrimmedString(value)
  if (!source) {
    return { ok: false, error: 'Invalid source label' }
  }

  if (!ALLOWED_SOURCE_LABELS.has(source)) {
    return {
      ok: false,
      error:
        'Unsupported source label. Use LIVE, SEED_DEMO, EXCEL_IMPORT, MANUAL_ESTIMATE, DEGRADED, MANUAL_ENTRY, or UNAVAILABLE',
    }
  }

  return { ok: true, source }
}

function normalizeFarmerPreferredLanguage(value: unknown): string | null {
  const preferredLanguage = parseTrimmedString(value)
  if (!preferredLanguage) return null

  const uppercase = preferredLanguage.toUpperCase()
  if (uppercase === 'DARIJA') return 'DARija'
  if (ALLOWED_FARMER_LANGUAGES.has(uppercase)) return uppercase

  if (preferredLanguage.length > 32) return null
  return preferredLanguage
}

function toFiniteNonNegativeNumber(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  if (parsed === null || parsed < 0) return null
  return parsed
}

export function validateFarmerDcaPayload(payload: Record<string, unknown>): FarmerDcaValidationSuccess | ValidationError {
  const parcelleId = parseTrimmedString(payload.parcelleId)
  if (!parcelleId) return { ok: false, error: 'parcelleId is required for FARMER DCA creation' }

  if (typeof payload.consentCndp !== 'boolean') {
    return { ok: false, error: 'consentCndp must be a boolean' }
  }

  const preferredLanguage = normalizeFarmerPreferredLanguage(payload.preferredLanguage)
  if (!preferredLanguage) {
    return { ok: false, error: 'preferredLanguage is required (DARija/AR/FR/EN or short validated string)' }
  }

  if (!Array.isArray(payload.documentsPrepared)) {
    return { ok: false, error: 'documentsPrepared must be an array' }
  }

  const documentsPrepared: FarmerDocumentPrepared[] = []
  for (let i = 0; i < payload.documentsPrepared.length; i += 1) {
    const document = payload.documentsPrepared[i]
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      return { ok: false, error: `documentsPrepared[${i}] must be an object` }
    }

    const row = document as Record<string, unknown>
    const type = parseTrimmedString(row.type)
    if (!type) {
      return { ok: false, error: `documentsPrepared[${i}].type is required` }
    }

    const sourceLabel = validateSourceLabel(row.sourceLabel)
    if ('error' in sourceLabel) {
      return { ok: false, error: `documentsPrepared[${i}].sourceLabel: ${sourceLabel.error}` }
    }

    documentsPrepared.push({
      type,
      sourceLabel: sourceLabel.source,
    })
  }

  const historyRaw = payload.declaredClaimHistory
  if (!historyRaw || typeof historyRaw !== 'object' || Array.isArray(historyRaw)) {
    return { ok: false, error: 'declaredClaimHistory is required and must be an object' }
  }

  const history = historyRaw as Record<string, unknown>
  const periodYears = parseFiniteNumber(history.periodYears)
  if (periodYears === null || !Number.isInteger(periodYears) || periodYears < 1 || periodYears > 10) {
    return { ok: false, error: 'declaredClaimHistory.periodYears must be an integer between 1 and 10' }
  }

  if (typeof history.noClaimsDeclared !== 'boolean') {
    return { ok: false, error: 'declaredClaimHistory.noClaimsDeclared must be a boolean' }
  }

  if (!Array.isArray(history.events)) {
    return { ok: false, error: 'declaredClaimHistory.events must be an array' }
  }

  if (history.noClaimsDeclared && history.events.length > 0) {
    return { ok: false, error: 'declaredClaimHistory.events must be empty when noClaimsDeclared is true' }
  }

  if (!history.noClaimsDeclared && history.events.length === 0) {
    return { ok: false, error: 'declaredClaimHistory.events must contain at least one event when noClaimsDeclared is false' }
  }

  const currentYear = new Date().getUTCFullYear()
  const minAllowedYear = currentYear - periodYears + 1
  const events: FarmerClaimHistoryEvent[] = []

  for (let i = 0; i < history.events.length; i += 1) {
    const event = history.events[i]
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      return { ok: false, error: `declaredClaimHistory.events[${i}] must be an object` }
    }

    const row = event as Record<string, unknown>
    const year = parseFiniteNumber(row.year)
    if (year === null || !Number.isInteger(year) || year < minAllowedYear || year > currentYear) {
      return {
        ok: false,
        error: `declaredClaimHistory.events[${i}].year must be an integer between ${minAllowedYear} and ${currentYear}`,
      }
    }

    const type = parseTrimmedString(row.type)
    if (!type) {
      return { ok: false, error: `declaredClaimHistory.events[${i}].type is required` }
    }

    const crop = parseTrimmedString(row.crop)
    if (!crop) {
      return { ok: false, error: `declaredClaimHistory.events[${i}].crop is required` }
    }

    const estimatedLossMad = row.estimatedLossMad === undefined ? null : toFiniteNonNegativeNumber(row.estimatedLossMad)
    if (row.estimatedLossMad !== undefined && estimatedLossMad === null) {
      return { ok: false, error: `declaredClaimHistory.events[${i}].estimatedLossMad must be a finite non-negative number` }
    }

    events.push({
      year,
      type,
      crop,
      estimatedLossMad,
      comment: parseTrimmedString(row.comment),
      sourceLabel: 'MANUAL_ESTIMATE',
    })
  }

  let source = 'MANUAL_ESTIMATE'
  if (payload.source !== undefined) {
    const parsedSource = validateSourceLabel(payload.source)
    if ('error' in parsedSource) return parsedSource
    source = parsedSource.source
  }

  return {
    ok: true,
    parcelleId,
    consentCndp: payload.consentCndp,
    preferredLanguage,
    documentsPrepared,
    declaredClaimHistory: {
      periodYears,
      noClaimsDeclared: history.noClaimsDeclared,
      events,
    },
    source,
  }
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
