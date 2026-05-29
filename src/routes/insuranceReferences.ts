import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { buildSourceDisclosure } from '../lib/sourceDisclosure.js'
import { getPinataConfigStatus } from '../lib/evidence/pinata.js'
import { getSolanaConfigStatus } from '../lib/evidence/solana.js'

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

export default async function insuranceReferenceRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/insurance/references', async () => {
    const [threats, vulnerabilities, raxParameters, claimCauses, claimStatuses, alertThresholds, pricingParameters] =
      await Promise.all([
        prisma.threatCatalog.findMany({ where: { country: 'MA', isActive: true }, orderBy: { code: 'asc' } }),
        prisma.vulnerabilityCatalog.findMany({ where: { country: 'MA', isActive: true }, orderBy: { code: 'asc' } }),
        prisma.raxParameterSet.findMany({ where: { country: 'MA' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] }),
        prisma.insuranceClaimCause.findMany({ where: { country: 'MA', active: true }, orderBy: { code: 'asc' } }),
        prisma.insuranceClaimStatusCatalog.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma.insuranceAlertThreshold.findMany({ where: { country: 'MA', active: true }, orderBy: { code: 'asc' } }),
        prisma.insurancePricingParameterSet.findMany({ where: { country: 'MA' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] }),
      ])

    return {
      threats: threats.map((row) => withDisclosure(row)),
      vulnerabilities: vulnerabilities.map((row) => withDisclosure(row)),
      raxParameters: raxParameters.map((row) => withDisclosure(row)),
      claimCauses: claimCauses.map((row) => withDisclosure(row)),
      claimStatuses: claimStatuses.map((row) => ({
        ...row,
        disclosure: buildSourceDisclosure({
          source: 'SEED_DEMO',
          confidence: 'MEDIUM',
        }),
      })),
      alertThresholds: alertThresholds.map((row) => withDisclosure(row)),
      pricingParameters: pricingParameters.map((row) => withDisclosure(row)),
    }
  })

  fastify.get('/v1/insurance/references/threats', async () => {
    const rows = await prisma.threatCatalog.findMany({
      where: { country: 'MA', isActive: true },
      orderBy: { code: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/insurance/references/vulnerabilities', async () => {
    const rows = await prisma.vulnerabilityCatalog.findMany({
      where: { country: 'MA', isActive: true },
      orderBy: { code: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/insurance/references/rax-parameters', async () => {
    const rows = await prisma.raxParameterSet.findMany({
      where: { country: 'MA' },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/insurance/references/claim-causes', async () => {
    const rows = await prisma.insuranceClaimCause.findMany({
      where: { country: 'MA', active: true },
      orderBy: { code: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/insurance/references/claim-statuses', async () => {
    const rows = await prisma.insuranceClaimStatusCatalog.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    })
    return rows.map((row) => ({
      ...row,
      disclosure: buildSourceDisclosure({
        source: 'SEED_DEMO',
        confidence: 'MEDIUM',
      }),
    }))
  })

  fastify.get('/v1/insurance/references/alert-thresholds', async () => {
    const rows = await prisma.insuranceAlertThreshold.findMany({
      where: { country: 'MA', active: true },
      orderBy: { code: 'asc' },
    })
    return rows.map((row) => withDisclosure(row))
  })

  fastify.get('/v1/insurance/references/pricing-parameters', async () => {
    const [pricingRows, taxFeeRows] = await Promise.all([
      prisma.insurancePricingParameterSet.findMany({
        where: { country: 'MA' },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      }),
      prisma.insuranceTaxFeeParameterSet.findMany({
        where: { country: 'MA' },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      }),
    ])

    return {
      pricing: pricingRows.map((row) => withDisclosure(row)),
      taxFees: taxFeeRows.map((row) => withDisclosure(row)),
    }
  })

  fastify.get('/v1/insurance/evidence/health', async () => {
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
}
