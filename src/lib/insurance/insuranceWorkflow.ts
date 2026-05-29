import prisma from '../prisma.js'
import { buildSourceDisclosure } from '../sourceDisclosure.js'
import { hashJsonStable } from '../evidence/hash.js'

interface CreateApplicationInput {
  country: string
  farmerId?: string | null
  parcelleId?: string | null
  cropCode: string
  regionCode?: string | null
  provinceCode?: string | null
  communeCode?: string | null
  lat?: number | null
  lng?: number | null
  surfaceHa?: number | null
  requestedCoverageAmount?: number | null
  source?: string | null
}

interface CreateMissionInput {
  applicationId: string
  agentUserId?: string | null
  missionType: string
  scheduledAt?: Date | null
  notes?: string | null
  source?: string | null
}

interface SyncFieldAuditInput {
  missionId?: string | null
  applicationId: string
  agentUserId: string
  deviceId?: string | null
  capturedAt: Date
  lat: number
  lng: number
  accuracyMeters?: number | null
  auditHashLocal?: string | null
  answersJson: unknown
  photos?: unknown[]
  offlineCreatedAt?: Date | null
  source: string
}

function normalizeSource(source?: string | null): string {
  if (!source) return 'LIVE'
  if (source === 'MANUAL_ENTRY') return 'MANUAL_ESTIMATE'
  return source
}

async function writeAuditLog(input: {
  entityType: string
  entityId: string
  action: string
  actorUserId?: string | null
  newValueJson: unknown
  source?: string
}) {
  await prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      newValueJson: JSON.stringify(input.newValueJson),
      source: input.source ?? 'LIVE',
    },
  })
}

export async function createInsuranceApplicationDraft(input: CreateApplicationInput, actorUserId?: string | null) {
  const source = normalizeSource(input.source)

  if (!input.farmerId) {
    const technicalDraft = {
      id: `TECH_${Date.now()}`,
      persisted: false,
      status: 'DRAFT',
      country: input.country,
      farmerId: null,
      parcelleId: input.parcelleId ?? null,
      cropType: input.cropCode,
      declaredSurfaceHa: input.surfaceHa ?? null,
      declaredLat: input.lat ?? null,
      declaredLng: input.lng ?? null,
      source,
      mode: 'TECHNICAL_PRE_APPLICATION',
      notes: 'No farmerId provided, draft kept as technical pre-application and not persisted in database.',
      sourceDisclosure: buildSourceDisclosure({
        source,
        provider: 'INSURANCE_WORKFLOW',
        confidence: 'LOW',
      }),
    }

    return technicalDraft
  }

  const farmer = await prisma.farmer.findUnique({
    where: { id: input.farmerId },
    select: { id: true, country: true },
  })

  if (!farmer) {
    throw new Error('Farmer not found')
  }

  const parcelle = input.parcelleId
    ? await prisma.parcelle.findUnique({ where: { id: input.parcelleId }, select: { id: true, superficie: true } })
    : null

  const declaredSurfaceHa =
    typeof input.surfaceHa === 'number' && Number.isFinite(input.surfaceHa) && input.surfaceHa > 0
      ? input.surfaceHa
      : parcelle?.superficie ?? 0.01

  const application = await prisma.insuranceApplication.create({
    data: {
      farmerId: farmer.id,
      parcelleId: parcelle?.id ?? null,
      country: 'MA',
      province: input.provinceCode ?? input.regionCode ?? null,
      commune: input.communeCode ?? null,
      cropType: input.cropCode,
      declaredSurfaceHa,
      declaredLat: input.lat ?? null,
      declaredLng: input.lng ?? null,
      status: 'DRAFT',
      source,
      cndpConsentChecked: false,
    },
  })

  await writeAuditLog({
    entityType: 'INSURANCE_APPLICATION',
    entityId: application.id,
    action: 'APPLICATION_DRAFT_CREATED',
    actorUserId,
    source,
    newValueJson: {
      regionCode: input.regionCode ?? null,
      provinceCode: input.provinceCode ?? null,
      communeCode: input.communeCode ?? null,
      requestedCoverageAmount: input.requestedCoverageAmount ?? null,
      originalSource: input.source ?? null,
    },
  })

  return {
    ...application,
    persisted: true,
    sourceDisclosure: buildSourceDisclosure({
      source: application.source,
      provider: 'INSURANCE_WORKFLOW',
      confidence: 'MEDIUM',
    }),
  }
}

export async function getInsuranceApplicationById(id: string) {
  const application = await prisma.insuranceApplication.findUnique({
    where: { id },
    include: {
      farmer: true,
      parcelle: true,
      insurerInstitution: true,
      missions: { orderBy: { createdAt: 'desc' }, take: 1 },
      fieldAudits: { orderBy: { createdAt: 'desc' }, take: 1 },
      raxEvaluations: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  if (!application) return null

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: 'INSURANCE_APPLICATION',
      entityId: id,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return {
    ...application,
    metaLogs: logs,
    sourceDisclosure: buildSourceDisclosure({
      source: application.source,
      provider: 'INSURANCE_WORKFLOW',
      confidence: 'MEDIUM',
    }),
  }
}

export async function listInsuranceApplications(input?: { page?: number; pageSize?: number }) {
  const page = Math.max(1, input?.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, input?.pageSize ?? 20))

  const [rows, total] = await Promise.all([
    prisma.insuranceApplication.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        farmer: { select: { id: true, firstName: true, lastName: true, country: true } },
        parcelle: { select: { id: true, name: true, culture: true } },
      },
    }),
    prisma.insuranceApplication.count(),
  ])

  return {
    data: rows.map((row) => ({
      ...row,
      sourceDisclosure: buildSourceDisclosure({
        source: row.source,
        provider: 'INSURANCE_WORKFLOW',
        confidence: 'MEDIUM',
      }),
    })),
    total,
    page,
    pageSize,
  }
}

export async function updateApplicationStatus(
  id: string,
  status: string,
  actorUserId?: string | null,
  note?: string | null
) {
  const application = await prisma.insuranceApplication.update({
    where: { id },
    data: { status },
  })

  await writeAuditLog({
    entityType: 'INSURANCE_APPLICATION',
    entityId: id,
    action: 'APPLICATION_STATUS_UPDATED',
    actorUserId,
    source: application.source,
    newValueJson: {
      status,
      note: note ?? null,
    },
  })

  return {
    ...application,
    sourceDisclosure: buildSourceDisclosure({
      source: application.source,
      provider: 'INSURANCE_WORKFLOW',
      confidence: 'MEDIUM',
    }),
  }
}

export async function createMissionForApplication(input: CreateMissionInput, actorUserId?: string | null) {
  const application = await prisma.insuranceApplication.findUnique({
    where: { id: input.applicationId },
    select: { id: true, source: true },
  })

  if (!application) {
    throw new Error('Insurance application not found')
  }

  const source = normalizeSource(input.source) || application.source
  const mission = await prisma.insuranceMission.create({
    data: {
      applicationId: application.id,
      assignedAgentUserId: input.agentUserId ?? null,
      status: input.agentUserId ? 'ASSIGNED' : 'CREATED',
      requiredKyc: true,
      requiredGpsPolygon: input.missionType !== 'CLAIM_INSPECTION',
      requirePhotos: true,
      requireSignature: input.missionType !== 'PARCEL_VERIFICATION',
      source,
      auditEquipment: input.missionType === 'CLAIM_INSPECTION',
      auditBuildings: input.missionType === 'CLAIM_INSPECTION',
      auditStocks: input.missionType === 'CLAIM_INSPECTION',
    },
  })

  await writeAuditLog({
    entityType: 'INSURANCE_MISSION',
    entityId: mission.id,
    action: 'MISSION_CREATED',
    actorUserId,
    source,
    newValueJson: {
      missionType: input.missionType,
      scheduledAt: input.scheduledAt?.toISOString() ?? null,
      notes: input.notes ?? null,
    },
  })

  return {
    ...mission,
    missionType: input.missionType,
    scheduledAt: input.scheduledAt ?? null,
    notes: input.notes ?? null,
    sourceDisclosure: buildSourceDisclosure({ source, provider: 'INSURANCE_WORKFLOW', confidence: 'MEDIUM' }),
  }
}

export async function assignMissionToAgent(
  missionId: string,
  agentUserId: string,
  actorUserId?: string | null
) {
  const mission = await prisma.insuranceMission.update({
    where: { id: missionId },
    data: {
      assignedAgentUserId: agentUserId,
      status: 'ASSIGNED',
    },
  })

  await writeAuditLog({
    entityType: 'INSURANCE_MISSION',
    entityId: mission.id,
    action: 'MISSION_ASSIGNED',
    actorUserId,
    source: mission.source,
    newValueJson: { assignedAgentUserId: agentUserId },
  })

  return {
    ...mission,
    sourceDisclosure: buildSourceDisclosure({
      source: mission.source,
      provider: 'INSURANCE_WORKFLOW',
      confidence: 'MEDIUM',
    }),
  }
}

export async function syncFieldAudit(input: SyncFieldAuditInput, actorUserId?: string | null) {
  const application = await prisma.insuranceApplication.findUnique({
    where: { id: input.applicationId },
    select: { id: true, source: true },
  })

  if (!application) {
    throw new Error('Insurance application not found')
  }

  if (input.missionId) {
    const mission = await prisma.insuranceMission.findUnique({ where: { id: input.missionId }, select: { id: true, applicationId: true } })
    if (!mission) throw new Error('Insurance mission not found')
    if (mission.applicationId !== application.id) {
      throw new Error('Mission does not belong to provided application')
    }
  }

  const canonicalPayload = {
    missionId: input.missionId ?? null,
    applicationId: input.applicationId,
    agentUserId: input.agentUserId,
    deviceId: input.deviceId ?? null,
    capturedAt: input.capturedAt.toISOString(),
    lat: Number(input.lat.toFixed(6)),
    lng: Number(input.lng.toFixed(6)),
    accuracyMeters: input.accuracyMeters ?? null,
    answersJson: input.answersJson,
    photos: input.photos ?? [],
    offlineCreatedAt: input.offlineCreatedAt?.toISOString() ?? null,
    source: normalizeSource(input.source),
  }

  const serverHash = hashJsonStable(canonicalPayload)
  const hashMatch = !input.auditHashLocal || input.auditHashLocal === serverHash
  const hashStatus = !input.auditHashLocal
    ? 'SERVER_VALIDATED'
    : hashMatch
      ? 'SERVER_VALIDATED'
      : 'NEEDS_REVIEW'

  const fieldAudit = await prisma.insuranceFieldAudit.create({
    data: {
      applicationId: application.id,
      missionId: input.missionId ?? null,
      agentUserId: input.agentUserId,
      gpsAccuracyM: input.accuracyMeters ?? null,
      photosJson: JSON.stringify(input.photos ?? []),
      assetsJson: JSON.stringify(canonicalPayload),
      agentComment: hashMatch ? null : 'Local/server hash mismatch. Manual security review required.',
      localPayloadHash: input.auditHashLocal ?? null,
      serverPayloadHash: serverHash,
      hashStatus,
      source: normalizeSource(input.source),
      syncedAt: new Date(),
    },
  })

  await writeAuditLog({
    entityType: 'INSURANCE_FIELD_AUDIT',
    entityId: fieldAudit.id,
    action: 'FIELD_AUDIT_SYNCED',
    actorUserId: actorUserId ?? input.agentUserId,
    source: fieldAudit.source,
    newValueJson: {
      hashMatch,
      hashStatus,
      missionId: input.missionId ?? null,
    },
  })

  return {
    fieldAudit,
    serverHash,
    hashMatch,
    status: hashStatus,
  }
}

export async function buildApplicationTechnicalSummary(applicationId: string) {
  const application = await prisma.insuranceApplication.findUnique({
    where: { id: applicationId },
    include: {
      farmer: { select: { id: true, firstName: true, lastName: true, country: true } },
      parcelle: { select: { id: true, name: true, culture: true, lat: true, lng: true, superficie: true } },
      missions: { orderBy: { createdAt: 'desc' }, take: 5 },
      fieldAudits: { orderBy: { createdAt: 'desc' }, take: 5 },
      raxEvaluations: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  })

  if (!application) return null

  const latestRax = application.raxEvaluations[0] ?? null
  const latestMission = application.missions[0] ?? null
  const latestFieldAudit = application.fieldAudits[0] ?? null

  return {
    applicationId: application.id,
    country: application.country,
    status: application.status,
    cropType: application.cropType,
    declaredSurfaceHa: application.declaredSurfaceHa,
    linkedFarmer: application.farmer,
    linkedParcelle: application.parcelle,
    latestMission,
    latestFieldAudit,
    latestRax,
    missionCount: application.missions.length,
    fieldAuditCount: application.fieldAudits.length,
    raxEvaluationCount: application.raxEvaluations.length,
    technicalRiskTier: latestRax?.riskTier ?? null,
    sourceDisclosure: buildSourceDisclosure({
      source: application.source,
      provider: 'INSURANCE_WORKFLOW',
      confidence: 'MEDIUM',
    }),
  }
}
