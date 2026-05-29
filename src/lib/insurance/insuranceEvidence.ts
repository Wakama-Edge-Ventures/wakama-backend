import prisma from '../prisma.js'
import { buildSourceDisclosure } from '../sourceDisclosure.js'
import { buildEvidenceBundle } from '../evidence/evidenceBundle.js'
import { enqueueAnchorJob } from '../evidence/anchorQueue.js'
import { getSolanaConfigStatus } from '../evidence/solana.js'

interface BundleCreationResult {
  bundleId: string
  bundleHash: string
  anchorStatus: string
  sourceDisclosure: ReturnType<typeof buildSourceDisclosure>
}

async function createEntityBundle(input: {
  entityType: string
  entityId: string
  payload: unknown
  source?: string
  createdByUserId?: string | null
}): Promise<BundleCreationResult> {
  const bundle = buildEvidenceBundle({
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
    source: input.source ?? 'MANUAL_ESTIMATE',
  })

  const record = await prisma.evidenceBundle.create({
    data: {
      entityType: bundle.entityType,
      entityId: bundle.entityId,
      bundleHash: bundle.bundleHash,
      payloadJson: bundle.payloadJson,
      source: bundle.source,
      status: 'READY_TO_ANCHOR',
      createdByUserId: input.createdByUserId ?? null,
    },
  })

  const solanaConfig = getSolanaConfigStatus()

  if (solanaConfig.anchoringEnabled || record.status === 'READY_TO_ANCHOR') {
    await enqueueAnchorJob({
      bundleId: record.id,
      entityType: record.entityType,
      entityId: record.entityId,
      payloadHash: record.bundleHash,
    })
  }

  return {
    bundleId: record.id,
    bundleHash: record.bundleHash,
    anchorStatus: solanaConfig.anchoringEnabled ? 'PENDING' : 'DISABLED_SAFE',
    sourceDisclosure: buildSourceDisclosure({
      source: bundle.source,
      provider: 'INSURANCE_EVIDENCE_BUNDLE',
      confidence: 'HIGH',
    }),
  }
}

export async function createApplicationEvidenceBundle(applicationId: string, createdByUserId?: string | null) {
  const application = await prisma.insuranceApplication.findUnique({
    where: { id: applicationId },
    include: {
      missions: { orderBy: { createdAt: 'desc' }, take: 5 },
      fieldAudits: { orderBy: { createdAt: 'desc' }, take: 5 },
      raxEvaluations: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  })

  if (!application) {
    throw new Error('Insurance application not found for evidence bundling')
  }

  return createEntityBundle({
    entityType: 'INSURANCE_APPLICATION',
    entityId: applicationId,
    payload: application,
    source: application.source,
    createdByUserId,
  })
}

export async function createFieldAuditEvidenceBundle(fieldAuditId: string, createdByUserId?: string | null) {
  const fieldAudit = await prisma.insuranceFieldAudit.findUnique({
    where: { id: fieldAuditId },
    include: {
      application: true,
      mission: true,
    },
  })

  if (!fieldAudit) {
    throw new Error('Insurance field audit not found for evidence bundling')
  }

  return createEntityBundle({
    entityType: 'INSURANCE_FIELD_AUDIT',
    entityId: fieldAuditId,
    payload: fieldAudit,
    source: fieldAudit.source,
    createdByUserId,
  })
}

export async function createRaxEvidenceBundle(raxEvaluationId: string, createdByUserId?: string | null) {
  const evaluation = await prisma.insuranceRaxEvaluation.findUnique({
    where: { id: raxEvaluationId },
    include: {
      application: true,
      farmer: true,
      parcelle: true,
    },
  })

  if (!evaluation) {
    throw new Error('RAX evaluation not found for evidence bundling')
  }

  return createEntityBundle({
    entityType: 'INSURANCE_RAX_EVALUATION',
    entityId: raxEvaluationId,
    payload: evaluation,
    source: evaluation.source,
    createdByUserId,
  })
}

export async function createAdHocEvidenceBundle(input: {
  entityType: string
  entityId: string
  payloadJson: unknown
  source?: string
  createdByUserId?: string | null
}) {
  return createEntityBundle({
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payloadJson,
    source: input.source,
    createdByUserId: input.createdByUserId,
  })
}
