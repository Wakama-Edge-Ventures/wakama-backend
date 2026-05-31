import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { buildSourceDisclosure } from '../lib/sourceDisclosure.js'
import { getPinataConfigStatus } from '../lib/evidence/pinata.js'
import { getSolanaConfigStatus } from '../lib/evidence/solana.js'
import { getUserContext, verifyToken } from '../middleware/auth.js'
import { isReadOnlyInstitutionUser } from '../middleware/ownership.js'
import {
  validateApplicationPayload,
  validateCountryMorocco,
  validateCropCode,
  validateDateRange,
  validateFarmerDcaPayload,
  validateFieldAuditSyncPayload,
  validateLatLng,
  validateMissionPayload,
  validateSourceLabel,
} from '../lib/insurance/insuranceValidation.js'
import {
  assignMissionToAgent,
  buildApplicationTechnicalSummary,
  createInsuranceApplicationDraft,
  createMissionForApplication,
  getInsuranceApplicationById,
  listInsuranceApplications,
  syncFieldAudit,
  updateApplicationStatus,
} from '../lib/insurance/insuranceWorkflow.js'
import { calculateHydroRisk } from '../lib/insurance/hydroRisk.js'
import { calculateRax } from '../lib/insurance/raxEngine.js'
import { getWeatherArchiveForPoint } from '../lib/insurance/weatherArchive.js'
import { getNdviHistoryForParcelle, getNdviHistoryForPoint } from '../lib/insurance/ndviHistory.js'
import {
  createAdHocEvidenceBundle,
  createApplicationEvidenceBundle,
  createFieldAuditEvidenceBundle,
  createRaxEvidenceBundle,
} from '../lib/insurance/insuranceEvidence.js'

const READ_ROLES = new Set(['SUPERADMIN', 'INSTITUTION_ADMIN', 'MFI_AGENT', 'FIELD_AGENT'])
const WRITE_ROLES = new Set(['SUPERADMIN', 'INSTITUTION_ADMIN', 'MFI_AGENT', 'FIELD_AGENT'])
const APPLICATION_READ_ROLES = new Set([...READ_ROLES, 'FARMER'])
const APPLICATION_CREATE_ROLES = new Set([...WRITE_ROLES, 'FARMER'])

async function requireInsuranceReadAccess(request: any, reply: any) {
  const context = await getUserContext(request)
  if (!context) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }

  if (!READ_ROLES.has(context.role)) {
    reply.status(403).send({ error: 'Forbidden' })
    return null
  }

  return context
}

async function requireInsuranceWriteAccess(request: any, reply: any) {
  const context = await getUserContext(request)
  if (!context) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }

  if (!WRITE_ROLES.has(context.role)) {
    reply.status(403).send({ error: 'Forbidden' })
    return null
  }

  if (isReadOnlyInstitutionUser(context)) {
    reply.status(403).send({ error: 'Forbidden' })
    return null
  }

  return context
}

async function requireInsuranceApplicationReadAccess(request: any, reply: any) {
  const context = await getUserContext(request)
  if (!context) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }

  if (!APPLICATION_READ_ROLES.has(context.role)) {
    reply.status(403).send({ error: 'Forbidden' })
    return null
  }

  if (context.role === 'FARMER' && !context.farmerId) {
    reply.status(403).send({ error: 'Farmer account is not linked to a farmer profile' })
    return null
  }

  return context
}

async function requireInsuranceApplicationCreateAccess(request: any, reply: any) {
  const context = await getUserContext(request)
  if (!context) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }

  if (!APPLICATION_CREATE_ROLES.has(context.role)) {
    reply.status(403).send({ error: 'Forbidden' })
    return null
  }

  if (context.role === 'FARMER') {
    if (!context.farmerId) {
      reply.status(403).send({ error: 'Farmer account is not linked to a farmer profile' })
      return null
    }

    return context
  }

  if (isReadOnlyInstitutionUser(context)) {
    reply.status(403).send({ error: 'Forbidden' })
    return null
  }

  return context
}

function parseFinite(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function parsePositive(value: unknown): number | null {
  const parsed = parseFinite(value)
  if (parsed === null || parsed <= 0) return null
  return parsed
}

function clampToScore(value: number): number {
  if (!Number.isFinite(value)) return 3
  if (value < 1) return 1
  if (value > 5) return 5
  return Number(value.toFixed(3))
}

function mapFrontendApplicationStatus(status: string): string {
  if (status === 'DRAFT') return 'DRAFT_SUBMITTED'
  return status
}

export default async function insuranceRoutes(fastify: FastifyInstance) {
  fastify.post('/applications', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceApplicationCreateAccess(request, reply)
    if (!context) return

    const payload = (request.body ?? {}) as Record<string, unknown>

    try {
      if (context.role === 'FARMER') {
        const validation = validateFarmerDcaPayload(payload)
        if ('error' in validation) return reply.status(400).send({ error: validation.error })

        const requestedFarmerId = typeof payload.farmerId === 'string' ? payload.farmerId.trim() : null
        if (requestedFarmerId && requestedFarmerId !== context.farmerId) {
          return reply.status(403).send({ error: 'Cannot create DCA for another farmer' })
        }

        const farmerExists = await prisma.farmer.findUnique({
          where: { id: context.farmerId },
          select: { id: true },
        })
        if (!farmerExists) {
          return reply.status(403).send({ error: 'Farmer profile not found' })
        }

        const parcelle = await prisma.parcelle.findUnique({
          where: { id: validation.parcelleId },
          select: { id: true, farmerId: true, culture: true },
        })

        if (!parcelle) {
          return reply.status(400).send({ error: 'parcelleId not found' })
        }

        if (parcelle.farmerId !== context.farmerId) {
          return reply.status(403).send({ error: 'parcelleId does not belong to authenticated farmer' })
        }

        const result = await createInsuranceApplicationDraft(
          {
            country: 'MA',
            farmerId: context.farmerId,
            parcelleId: validation.parcelleId,
            cropCode:
              typeof payload.cropCode === 'string' && payload.cropCode.trim()
                ? payload.cropCode.trim().toUpperCase()
                : parcelle.culture,
            regionCode: typeof payload.regionCode === 'string' ? payload.regionCode : null,
            provinceCode: typeof payload.provinceCode === 'string' ? payload.provinceCode : null,
            communeCode: typeof payload.communeCode === 'string' ? payload.communeCode : null,
            lat: parseFinite(payload.lat),
            lng: parseFinite(payload.lng),
            surfaceHa: parsePositive(payload.surfaceHa),
            requestedCoverageAmount: parsePositive(payload.requestedCoverageAmount),
            source: validation.source,
            consentCndp: validation.consentCndp,
            preferredLanguage: validation.preferredLanguage,
            documentsPrepared: validation.documentsPrepared,
            declaredClaimHistory: validation.declaredClaimHistory,
          },
          context.userId
        )
        const createdAt = 'createdAt' in result ? result.createdAt : null

        return reply.status(201).send({
          id: result.id,
          status: result.status,
          frontendStatus: mapFrontendApplicationStatus(result.status),
          farmerId: result.farmerId,
          parcelleId: result.parcelleId,
          dcaDeclarationId: result.dcaDeclarationId ?? null,
          preparedDocumentsCount: result.preparedDocumentsCount ?? 0,
          declaredClaimEventsCount: result.declaredClaimEventsCount ?? 0,
          source: result.source,
          sourceLabel: result.source,
          createdAt,
          message: 'DCA application created as initial draft. No mission, policy, claim, pricing, or RAX created automatically.',
          sideEffects: {
            missionCreated: false,
            policyCreated: false,
            claimCreated: false,
            raxCalculated: false,
            pricingCalculated: false,
            blockchainAnchored: false,
          },
          application: result,
          sourceDisclosure:
            result.sourceDisclosure ??
            buildSourceDisclosure({ source: 'LIVE', provider: 'INSURANCE_WORKFLOW', confidence: 'MEDIUM' }),
        })
      }

      const validation = validateApplicationPayload(payload)
      if ('error' in validation) return reply.status(400).send({ error: validation.error })

      const result = await createInsuranceApplicationDraft(
        {
          country: validation.country,
          farmerId: validation.farmerId,
          parcelleId: validation.parcelleId,
          cropCode: validation.cropCode,
          regionCode: typeof payload.regionCode === 'string' ? payload.regionCode : null,
          provinceCode: typeof payload.provinceCode === 'string' ? payload.provinceCode : null,
          communeCode: typeof payload.communeCode === 'string' ? payload.communeCode : null,
          lat: parseFinite(payload.lat),
          lng: parseFinite(payload.lng),
          surfaceHa: parsePositive(payload.surfaceHa),
          requestedCoverageAmount: parsePositive(payload.requestedCoverageAmount),
          source: typeof payload.source === 'string' ? payload.source : 'LIVE',
        },
        context.userId
      )
      const createdAt = 'createdAt' in result ? result.createdAt : null

      const statusCode = result.persisted ? 201 : 202
      return reply.status(statusCode).send({
        id: result.id,
        status: result.status,
        frontendStatus: mapFrontendApplicationStatus(result.status),
        farmerId: result.farmerId,
        parcelleId: result.parcelleId,
        dcaDeclarationId: result.dcaDeclarationId ?? null,
        preparedDocumentsCount: result.preparedDocumentsCount ?? 0,
        declaredClaimEventsCount: result.declaredClaimEventsCount ?? 0,
        source: result.source,
        sourceLabel: result.source,
        createdAt,
        message: 'Insurance application draft created.',
        application: result,
        sourceDisclosure:
          result.sourceDisclosure ??
          buildSourceDisclosure({ source: 'LIVE', provider: 'INSURANCE_WORKFLOW', confidence: 'MEDIUM' }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create insurance application draft'
      return reply.status(400).send({ error: message })
    }
  })

  fastify.get('/applications', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceApplicationReadAccess(request, reply)
    if (!context) return

    const query = request.query as { page?: string; pageSize?: string }
    const page = Number(query.page ?? '1')
    const pageSize = Number(query.pageSize ?? '20')

    const rows = await listInsuranceApplications({
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
      farmerId: context.role === 'FARMER' ? context.farmerId : null,
    })

    return {
      ...rows,
      data: rows.data.map((row) => ({
        ...row,
        frontendStatus: mapFrontendApplicationStatus(row.status),
      })),
      sourceDisclosure: buildSourceDisclosure({
        source: 'LIVE',
        provider: 'INSURANCE_WORKFLOW',
        confidence: 'MEDIUM',
      }),
    }
  })

  fastify.get('/applications/:id', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceApplicationReadAccess(request, reply)
    if (!context) return

    const { id } = request.params as { id: string }
    const application = await getInsuranceApplicationById(id, {
      farmerId: context.role === 'FARMER' ? context.farmerId : null,
    })
    if (!application) return reply.status(404).send({ error: 'Insurance application not found' })

    let hydroRisk = null
    const lat = application.declaredLat
    const lng = application.declaredLng

    if (typeof lat === 'number' && typeof lng === 'number') {
      hydroRisk = await calculateHydroRisk(lat, lng)
    }

    return {
      application,
      frontendStatus: mapFrontendApplicationStatus(application.status),
      dcaDeclaration: application.dcaDeclaration
        ? (() => {
            const { preparedDocuments, declaredClaimEvents, ...declaration } = application.dcaDeclaration
            return declaration
          })()
        : null,
      preparedDocuments: application.dcaDeclaration?.preparedDocuments ?? [],
      declaredClaimEvents: application.dcaDeclaration?.declaredClaimEvents ?? [],
      deprecatedLegacyAuditDcaFallback: application.deprecatedLegacyAuditDcaFallback ?? null,
      farmer: application.farmer ?? null,
      parcelle: application.parcelle ?? null,
      latestRax: application.raxEvaluations[0] ?? null,
      latestMission: application.missions[0] ?? null,
      latestFieldAudit: application.fieldAudits[0] ?? null,
      hydroRisk,
      sourceDisclosure: buildSourceDisclosure({
        source: application.source,
        provider: 'INSURANCE_APPLICATION_VIEW',
        confidence: 'MEDIUM',
      }),
    }
  })

  fastify.post('/applications/:id/submit', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceWriteAccess(request, reply)
    if (!context) return

    const { id } = request.params as { id: string }
    const application = await prisma.insuranceApplication.findUnique({ where: { id } })
    if (!application) return reply.status(404).send({ error: 'Insurance application not found' })

    if (application.status !== 'DRAFT') {
      return reply.status(409).send({ error: 'Only DRAFT applications can be submitted' })
    }

    const updated = await updateApplicationStatus(id, 'SUBMITTED', context.userId, 'Manual submit route called')

    return {
      application: updated,
      note: 'Application moved to SUBMITTED. Not sent to insurer automatically.',
      sourceDisclosure: updated.sourceDisclosure,
    }
  })

  fastify.post('/missions', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceWriteAccess(request, reply)
    if (!context) return

    const payload = (request.body ?? {}) as Record<string, unknown>
    const validation = validateMissionPayload(payload)
    if ('error' in validation) return reply.status(400).send({ error: validation.error })

    try {
      const mission = await createMissionForApplication(
        {
          applicationId: validation.applicationId,
          agentUserId: validation.agentUserId,
          missionType: validation.missionType,
          scheduledAt: validation.scheduledAt,
          notes: validation.notes,
          source: typeof payload.source === 'string' ? payload.source : 'LIVE',
        },
        context.userId
      )

      return reply.status(201).send({
        mission,
        sourceDisclosure: mission.sourceDisclosure,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create mission'
      return reply.status(400).send({ error: message })
    }
  })

  fastify.get('/missions', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceReadAccess(request, reply)
    if (!context) return

    const { page = '1', pageSize = '20' } = request.query as { page?: string; pageSize?: string }
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const sizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))

    const [rows, total] = await Promise.all([
      prisma.insuranceMission.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        include: {
          application: {
            select: {
              id: true,
              status: true,
              country: true,
              cropType: true,
            },
          },
          assignedAgentUser: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.insuranceMission.count(),
    ])

    return {
      data: rows.map((row) => ({
        ...row,
        sourceDisclosure: buildSourceDisclosure({ source: row.source, provider: 'INSURANCE_WORKFLOW', confidence: 'MEDIUM' }),
      })),
      total,
      page: pageNum,
      pageSize: sizeNum,
      sourceDisclosure: buildSourceDisclosure({ source: 'LIVE', provider: 'INSURANCE_WORKFLOW', confidence: 'MEDIUM' }),
    }
  })

  fastify.get('/missions/:id', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceReadAccess(request, reply)
    if (!context) return

    const { id } = request.params as { id: string }

    const mission = await prisma.insuranceMission.findUnique({
      where: { id },
      include: {
        application: true,
        assignedAgentUser: { select: { id: true, email: true, role: true } },
        fieldAudits: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })

    if (!mission) return reply.status(404).send({ error: 'Insurance mission not found' })

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'INSURANCE_MISSION',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return {
      mission,
      logs,
      sourceDisclosure: buildSourceDisclosure({
        source: mission.source,
        provider: 'INSURANCE_WORKFLOW',
        confidence: 'MEDIUM',
      }),
    }
  })

  fastify.post('/missions/:id/assign', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceWriteAccess(request, reply)
    if (!context) return

    const { id } = request.params as { id: string }
    const body = (request.body ?? {}) as Record<string, unknown>
    const agentUserId = typeof body.agentUserId === 'string' ? body.agentUserId.trim() : ''
    if (!agentUserId) return reply.status(400).send({ error: 'agentUserId is required' })

    try {
      const mission = await assignMissionToAgent(id, agentUserId, context.userId)
      return {
        mission,
        sourceDisclosure: mission.sourceDisclosure,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign mission'
      return reply.status(400).send({ error: message })
    }
  })

  fastify.post('/missions/:id/status', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceWriteAccess(request, reply)
    if (!context) return

    const { id } = request.params as { id: string }
    const body = (request.body ?? {}) as Record<string, unknown>
    const status = typeof body.status === 'string' ? body.status.trim() : ''

    const allowedStatus = new Set([
      'CREATED',
      'ASSIGNED',
      'IN_PROGRESS',
      'SUBMITTED',
      'REVIEWED',
      'REJECTED',
      'CANCELLED',
    ])

    if (!status || !allowedStatus.has(status)) {
      return reply.status(400).send({ error: 'Invalid mission status' })
    }

    const mission = await prisma.insuranceMission.update({
      where: { id },
      data: { status },
    })

    await prisma.auditLog.create({
      data: {
        entityType: 'INSURANCE_MISSION',
        entityId: id,
        action: 'MISSION_STATUS_UPDATED',
        actorUserId: context.userId,
        newValueJson: JSON.stringify({ status }),
        source: mission.source,
      },
    })

    return {
      mission,
      sourceDisclosure: buildSourceDisclosure({
        source: mission.source,
        provider: 'INSURANCE_WORKFLOW',
        confidence: 'MEDIUM',
      }),
    }
  })

  fastify.post('/field-audit/sync', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceWriteAccess(request, reply)
    if (!context) return

    const payload = (request.body ?? {}) as Record<string, unknown>
    const validation = validateFieldAuditSyncPayload(payload)
    if ('error' in validation) return reply.status(400).send({ error: validation.error })

    try {
      const synced = await syncFieldAudit(
        {
          missionId: validation.missionId,
          applicationId: validation.applicationId,
          agentUserId: validation.agentUserId,
          deviceId: validation.deviceId,
          capturedAt: validation.capturedAt,
          lat: validation.lat,
          lng: validation.lng,
          accuracyMeters: validation.accuracyMeters,
          auditHashLocal: validation.auditHashLocal,
          answersJson: validation.answersJson,
          photos: validation.photos,
          offlineCreatedAt: validation.offlineCreatedAt,
          source: validation.source,
        },
        context.userId
      )

      const evidence = await createFieldAuditEvidenceBundle(synced.fieldAudit.id, context.userId)
      const strictStatus = !synced.hashMatch && validation.auditHashLocal ? 'SECURITY_HOLD' : synced.status

      if (strictStatus === 'SECURITY_HOLD') {
        await prisma.insuranceFieldAudit.update({
          where: { id: synced.fieldAudit.id },
          data: { hashStatus: 'SECURITY_HOLD' },
        })
      }

      return {
        fieldAuditId: synced.fieldAudit.id,
        serverHash: synced.serverHash,
        hashMatch: synced.hashMatch,
        status: strictStatus,
        evidenceBundleId: evidence.bundleId,
        bundleHash: evidence.bundleHash,
        anchorStatus: evidence.anchorStatus,
        sourceDisclosure: buildSourceDisclosure({
          source: synced.fieldAudit.source,
          provider: 'INSURANCE_FIELD_AUDIT_SYNC',
          confidence: synced.hashMatch ? 'HIGH' : 'MEDIUM',
        }),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync field audit'
      return reply.status(400).send({ error: message })
    }
  })

  fastify.post('/rax/calculate', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceWriteAccess(request, reply)
    if (!context) return

    const payload = (request.body ?? {}) as Record<string, unknown>
    const country = validateCountryMorocco(payload.country)
    if ('error' in country) return reply.status(400).send({ error: country.error })

    const cropCode = validateCropCode(payload.cropCode)
    if ('error' in cropCode) return reply.status(400).send({ error: cropCode.error })

    const coords = validateLatLng(payload.lat, payload.lng)
    if ('error' in coords) return reply.status(400).send({ error: coords.error })

    const applicationId = typeof payload.applicationId === 'string' ? payload.applicationId : null
    const farmerId = typeof payload.farmerId === 'string' ? payload.farmerId : null
    const parcelleId = typeof payload.parcelleId === 'string' ? payload.parcelleId : null

    let gravityScore = parseFinite(payload.gravityScore)
    let frequencyScore = parseFinite(payload.frequencyScore)
    let detectionScore = parseFinite(payload.detectionScore)

    const explanationFactors: string[] = []
    const warnings: string[] = []

    const cropReference = await prisma.insuranceCropCategory.findFirst({
      where: {
        country: 'MA',
        code: cropCode.cropCode,
      },
    })

    if (gravityScore === null) {
      gravityScore = cropReference?.defaultRaxGravity ?? 3
      explanationFactors.push(`gravityScore inferred from crop reference ${cropCode.cropCode}`)
    }

    if (frequencyScore === null) {
      frequencyScore = cropReference?.defaultRaxFrequency ?? 3
      explanationFactors.push(`frequencyScore inferred from crop reference ${cropCode.cropCode}`)
    }

    if (detectionScore === null) {
      detectionScore = 3
      explanationFactors.push('detectionScore defaulted to 3 pending field audit and monitoring signals')
    }

    const useHydroRisk = payload.useHydroRisk !== false
    const useWeatherArchive = payload.useWeatherArchive !== false
    const useNdviHistory = payload.useNdviHistory !== false

    let hydroRisk: Awaited<ReturnType<typeof calculateHydroRisk>> | null = null
    if (useHydroRisk) {
      hydroRisk = await calculateHydroRisk(coords.lat, coords.lng)

      if (hydroRisk.hydroRiskLevel === 'CRITICAL') {
        gravityScore += 1
        frequencyScore += 1
      } else if (hydroRisk.hydroRiskLevel === 'HIGH') {
        gravityScore += 0.8
        frequencyScore += 0.7
      } else if (hydroRisk.hydroRiskLevel === 'MEDIUM') {
        gravityScore += 0.4
      }

      explanationFactors.push(`hydro risk signal applied: ${hydroRisk.hydroRiskLevel}`)
      warnings.push(...hydroRisk.warnings)
    }

    let weatherArchive: Awaited<ReturnType<typeof getWeatherArchiveForPoint>> | null = null
    if (useWeatherArchive && typeof payload.startDate === 'string' && typeof payload.endDate === 'string') {
      const dateRange = validateDateRange(payload.startDate, payload.endDate, 366)
      if ('error' in dateRange) {
        warnings.push(`weather archive skipped: ${dateRange.error}`)
      } else {
        weatherArchive = await getWeatherArchiveForPoint({
          lat: coords.lat,
          lng: coords.lng,
          startDate: payload.startDate,
          endDate: payload.endDate,
          provider: 'OPEN_METEO_ARCHIVE',
          allowLiveFetch: true,
        })

        if (weatherArchive.rows.length) {
          const precipValues = weatherArchive.rows
            .map((row) => row.precipitation)
            .filter((value): value is number => typeof value === 'number')

          if (precipValues.length) {
            const averagePrecip = precipValues.reduce((sum, value) => sum + value, 0) / precipValues.length
            if (averagePrecip >= 8) {
              frequencyScore += 0.8
              gravityScore += 0.4
              explanationFactors.push(`weather archive average precipitation ${averagePrecip.toFixed(2)}mm/day increased hydro-sensitive risk weighting`)
            } else if (averagePrecip <= 0.5) {
              gravityScore += 0.4
              explanationFactors.push(`weather archive low precipitation (${averagePrecip.toFixed(2)}mm/day) increased drought-side gravity signal`)
            }
          }
        }

        if (weatherArchive.status !== 'OK') {
          warnings.push(`weather archive status: ${weatherArchive.status}`)
          warnings.push(...weatherArchive.warnings)
        }
      }
    }

    let ndviHistory: Awaited<ReturnType<typeof getNdviHistoryForPoint>> | null = null
    if (useNdviHistory && typeof payload.startDate === 'string' && typeof payload.endDate === 'string') {
      const dateRange = validateDateRange(payload.startDate, payload.endDate, 366)
      if ('error' in dateRange) {
        warnings.push(`ndvi history skipped: ${dateRange.error}`)
      } else {
        ndviHistory = await getNdviHistoryForPoint({
          lat: coords.lat,
          lng: coords.lng,
          startDate: payload.startDate,
          endDate: payload.endDate,
        })

        if (ndviHistory.status === 'OK') {
          if (ndviHistory.trend.anomalyLevel === 'CRITICAL') {
            gravityScore += 1
            frequencyScore += 0.6
            explanationFactors.push('NDVI trend anomaly CRITICAL increased gravity/frequency scores')
          } else if (ndviHistory.trend.anomalyLevel === 'WARNING') {
            gravityScore += 0.6
            explanationFactors.push('NDVI trend anomaly WARNING increased gravity score')
          } else if (ndviHistory.trend.anomalyLevel === 'WATCH') {
            gravityScore += 0.3
            explanationFactors.push('NDVI trend anomaly WATCH slightly increased gravity score')
          }
        } else {
          warnings.push('NDVI history unavailable; scoring proceeded without NDVI signal')
        }
      }
    }

    if (applicationId) {
      const latestAudit = await prisma.insuranceFieldAudit.findFirst({
        where: { applicationId },
        orderBy: { createdAt: 'desc' },
      })

      if (latestAudit && latestAudit.hashStatus !== 'SERVER_VALIDATED') {
        detectionScore += 0.8
        explanationFactors.push(`latest field audit hashStatus ${latestAudit.hashStatus} increased detection difficulty score`)
      }
    }

    gravityScore = clampToScore(gravityScore)
    frequencyScore = clampToScore(frequencyScore)
    detectionScore = clampToScore(detectionScore)

    const calculated = calculateRax({
      gravityScore,
      frequencyScore,
      detectionScore,
      source: 'MANUAL_ESTIMATE',
      provider: 'RAX_ENGINE',
      confidence: 'MEDIUM',
      explanationFactors,
    })

    calculated.warnings.push(...warnings)

    let savedEvaluation: any = null
    let evidence: any = null

    if (applicationId) {
      savedEvaluation = await prisma.insuranceRaxEvaluation.create({
        data: {
          applicationId,
          farmerId,
          parcelleId,
          country: 'MA',
          gravityScore: calculated.gravityScore,
          frequencyScore: calculated.frequencyScore,
          detectionScore: calculated.detectionScore,
          raxBrut: calculated.raxBrut,
          wrs: calculated.wrs,
          riskTier: calculated.riskTier,
          explanationJson: JSON.stringify({
            explanationFactors: calculated.explanationFactors,
            warnings: calculated.warnings,
            hydroRisk,
            weatherArchiveStatus: weatherArchive?.status ?? null,
            ndviStatus: ndviHistory?.status ?? null,
          }),
          source: calculated.sourceDisclosure.source,
          algorithmVersion: calculated.algorithmVersion,
        },
      })

      evidence = await createRaxEvidenceBundle(savedEvaluation.id, context.userId)
    }

    return {
      technicalRisk: calculated,
      note: 'Technical risk score only. Insurer remains sole decision maker for eligibility, pricing, policy issuance, and indemnification.',
      savedEvaluation,
      evidence,
      hydroRisk,
      weatherArchive,
      ndviHistory,
      sourceDisclosure: buildSourceDisclosure({
        source: calculated.sourceDisclosure.source,
        provider: 'RAX_ENGINE',
        confidence: calculated.sourceDisclosure.confidence,
      }),
    }
  })

  fastify.get('/applications/:id/rax', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceReadAccess(request, reply)
    if (!context) return

    const { id } = request.params as { id: string }

    const rows = await prisma.insuranceRaxEvaluation.findMany({
      where: { applicationId: id },
      orderBy: { createdAt: 'desc' },
    })

    return {
      applicationId: id,
      evaluations: rows.map((row) => ({
        ...row,
        technicalRiskTier: row.riskTier,
        sourceDisclosure: buildSourceDisclosure({
          source: row.source,
          provider: 'RAX_ENGINE',
          confidence: 'MEDIUM',
        }),
      })),
      sourceDisclosure: buildSourceDisclosure({
        source: rows[0]?.source ?? 'SEED_DEMO',
        provider: 'RAX_ENGINE',
        confidence: rows.length ? 'MEDIUM' : 'LOW',
      }),
    }
  })

  fastify.get('/hydro-risk', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceReadAccess(request, reply)
    if (!context) return

    const { lat, lng, radiusKm } = request.query as {
      lat?: string
      lng?: string
      radiusKm?: string
    }

    const coords = validateLatLng(lat, lng)
    if ('error' in coords) return reply.status(400).send({ error: coords.error })

    const radius = parseFinite(radiusKm)

    const risk = await calculateHydroRisk(coords.lat, coords.lng, {
      radiusKm: radius !== null && radius > 0 ? radius : undefined,
    })

    return {
      ...risk,
      sourceDisclosure: risk.sourceDisclosure,
    }
  })

  fastify.get('/weather/archive', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceReadAccess(request, reply)
    if (!context) return

    const { lat, lng, startDate, endDate } = request.query as {
      lat?: string
      lng?: string
      startDate?: string
      endDate?: string
    }

    const coords = validateLatLng(lat, lng)
    if ('error' in coords) return reply.status(400).send({ error: coords.error })

    if (!startDate || !endDate) {
      return reply.status(400).send({ error: 'startDate and endDate are required (YYYY-MM-DD)' })
    }

    const archive = await getWeatherArchiveForPoint({
      lat: coords.lat,
      lng: coords.lng,
      startDate,
      endDate,
      provider: 'OPEN_METEO_ARCHIVE',
      allowLiveFetch: true,
    })

    return {
      status: archive.status,
      rows: archive.rows,
      warnings: archive.warnings,
      sourceDisclosure: archive.sourceDisclosure,
    }
  })

  fastify.get('/ndvi/history', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceReadAccess(request, reply)
    if (!context) return

    const query = request.query as {
      parcelleId?: string
      lat?: string
      lng?: string
      startDate?: string
      endDate?: string
    }

    if (query.parcelleId) {
      const history = await getNdviHistoryForParcelle(query.parcelleId)
      return {
        ...history,
        sourceDisclosure: history.sourceDisclosure,
      }
    }

    const coords = validateLatLng(query.lat, query.lng)
    if ('error' in coords) return reply.status(400).send({ error: coords.error })

    if (!query.startDate || !query.endDate) {
      return reply
        .status(400)
        .send({ error: 'For point query, startDate and endDate are required (YYYY-MM-DD)' })
    }

    const history = await getNdviHistoryForPoint({
      lat: coords.lat,
      lng: coords.lng,
      startDate: query.startDate,
      endDate: query.endDate,
    })

    return {
      ...history,
      sourceDisclosure: history.sourceDisclosure,
    }
  })

  fastify.post('/evidence/bundle', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceWriteAccess(request, reply)
    if (!context) return

    const body = (request.body ?? {}) as Record<string, unknown>
    const entityType = typeof body.entityType === 'string' ? body.entityType.trim() : ''
    const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : ''

    if (!entityType || !entityId) {
      return reply.status(400).send({ error: 'entityType and entityId are required' })
    }

    if (body.source !== undefined) {
      const source = validateSourceLabel(body.source)
      if ('error' in source) return reply.status(400).send({ error: source.error })
    }

    const bundle = await createAdHocEvidenceBundle({
      entityType,
      entityId,
      payloadJson: body.payloadJson ?? {},
      source: typeof body.source === 'string' ? body.source : 'MANUAL_ESTIMATE',
      createdByUserId: context.userId,
    })

    return {
      bundleId: bundle.bundleId,
      bundleHash: bundle.bundleHash,
      anchorStatus: bundle.anchorStatus,
      sourceDisclosure: bundle.sourceDisclosure,
    }
  })

  fastify.post('/applications/:id/evidence-bundle', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceWriteAccess(request, reply)
    if (!context) return
    const { id } = request.params as { id: string }

    try {
      const bundle = await createApplicationEvidenceBundle(id, context.userId)
      return {
        bundleId: bundle.bundleId,
        bundleHash: bundle.bundleHash,
        anchorStatus: bundle.anchorStatus,
        sourceDisclosure: bundle.sourceDisclosure,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create application evidence bundle'
      return reply.status(400).send({ error: message })
    }
  })

  fastify.get('/evidence/health', async () => {
    const pinata = getPinataConfigStatus()
    const solana = getSolanaConfigStatus()
    const ready =
      pinata.pinataUploadEnabled &&
      pinata.hasJwt &&
      solana.anchoringEnabled &&
      solana.rpcUrlConfigured &&
      solana.privateKeyConfigured

    return {
      pinataUploadEnabled: pinata.pinataUploadEnabled,
      anchoringEnabled: solana.anchoringEnabled,
      solanaCluster: solana.cluster,
      mode: ready ? 'READY' : 'DISABLED_SAFE',
    }
  })

  fastify.get('/applications/:id/technical-summary', { preHandler: verifyToken }, async (request, reply) => {
    const context = await requireInsuranceReadAccess(request, reply)
    if (!context) return

    const { id } = request.params as { id: string }
    const summary = await buildApplicationTechnicalSummary(id)
    if (!summary) return reply.status(404).send({ error: 'Insurance application not found' })

    return summary
  })
}
