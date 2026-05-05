import prisma from './prisma.js'
import { calculateWakamaScore, type WakamaScoreResult } from './wakamaScore.js'
import type { AuthUserContext } from '../types/auth.js'

export const SCORE_MODEL_VERSION = 'wakama-score-4c-v1.1'
export const DOSSIER_VERSION = 'dossier-comite-v1'
export const COMPLIANCE_NOTICE = 'D\u00e9cision finale r\u00e9serv\u00e9e \u00e0 l\u2019institution.'

type ScoreWeights = {
  c1: number
  c2: number
  c3: number
  c4: number
}

type DossierBundle = {
  farmer: {
    id: string
    firstName: string
    lastName: string
    phone: string
    region: string
    village: string
    lat: number
    lng: number
    onboardedAt: Date
    kycStatus: string
    photoUrl: string | null
    cniUrl: string | null
    attestationUrl: string | null
    cooperativeId: string | null
    experienceAnnees: string | null
    historicCredit: string | null
    user: { id: string; email: string } | null
    cooperative: {
      id: string
      name: string
      region: string
      filiere: string
      rccm: string
      institutionId: string | null
    } | null
    parcelles: Array<{
      id: string
      name: string
      culture: string
      superficie: number
      lat: number
      lng: number
      polygone: string | null
      ndvi: number | null
      statut: string
      stade: string | null
      datePlantation: Date | null
    }>
    alerts: Array<{
      id: string
      severity: string
      title: string
      message: string
      createdAt: Date
      read: boolean
    }>
    activities: Array<{
      id: string
      type: string
      date: Date
      statut: string
    }>
    creditRequests: Array<{
      id: string
      statut: string
      montant: number
      montantAccorde: number | null
      createdAt: Date
    }>
  }
  weights: ScoreWeights
  weightsSource: 'DEFAULT' | 'INSTITUTION_CONFIG'
  products: Array<{ name: string; minScore: number; eligible: boolean; [key: string]: unknown }> | null
  institutionId: string | null
  generatedAt: string
  scoreResult: WakamaScoreResult
  finalScore: number
  scoreStatus: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  scoreMax: number
}

export async function calculatePresentedScore(
  farmerId: string,
  institutionId?: string | null
): Promise<{
  result: WakamaScoreResult
  finalScore: number
  weights: ScoreWeights
  weightsSource: 'DEFAULT' | 'INSTITUTION_CONFIG'
  products: Array<{ name: string; minScore: number; eligible: boolean; [key: string]: unknown }> | null
  institutionId: string | null
  status: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  scoreMax: number
  generatedAt: string
}> {
  const result = await calculateWakamaScore(farmerId)

  let finalScore = result.score
  let weights: ScoreWeights = { c1: 30, c2: 25, c3: 25, c4: 20 }
  let weightsSource: 'DEFAULT' | 'INSTITUTION_CONFIG' = 'DEFAULT'
  let products: Array<{ name: string; minScore: number; eligible: boolean; [key: string]: unknown }> | null = null

  if (institutionId) {
    const config = await prisma.institutionScoringConfig.findUnique({
      where: { institutionId },
    })

    if (config) {
      weights = {
        c1: config.weightC1,
        c2: config.weightC2,
        c3: config.weightC3,
        c4: config.weightC4,
      }
      weightsSource = 'INSTITUTION_CONFIG'

      const scoreWeighted = (
        result.scoreC1 * (config.weightC1 / 100) +
        result.scoreC2 * (config.weightC2 / 100) +
        result.scoreC3 * (config.weightC3 / 100) +
        result.scoreC4 * (config.weightC4 / 100)
      )
      finalScore = Math.round(scoreWeighted * 10)

      if (config.products) {
        const rawProducts = config.products as Array<Record<string, unknown>>
        if (Array.isArray(rawProducts)) {
          products = rawProducts.map(product => ({
            ...product,
            name: String(product.name ?? 'Produit'),
            minScore: Number(product.minScore ?? 0),
            eligible: finalScore >= Number(product.minScore ?? 0),
          }))
        }
      }
    }
  }

  return {
    result,
    finalScore,
    weights,
    weightsSource,
    products,
    institutionId: institutionId ?? null,
    status: getScoreStatus(finalScore),
    riskLevel: getRiskLevel(finalScore),
    scoreMax: 1000,
    generatedAt: new Date().toISOString(),
  }
}

export async function loadDossierBundle(
  farmerId: string,
  institutionId?: string | null,
  options?: { useCooperativeInstitutionFallback?: boolean }
): Promise<DossierBundle> {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    include: {
      user: { select: { id: true, email: true } },
      cooperative: {
        select: {
          id: true,
          name: true,
          region: true,
          filiere: true,
          rccm: true,
          institutionId: true,
        },
      },
      parcelles: {
        orderBy: { lastUpdatedAt: 'desc' },
      },
      alerts: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      activities: {
        orderBy: { date: 'desc' },
        take: 20,
      },
      creditRequests: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!farmer) {
    throw new Error('Farmer not found')
  }

  const effectiveInstitutionId = institutionId ?? (
    options?.useCooperativeInstitutionFallback
      ? farmer.cooperative?.institutionId ?? null
      : null
  )
  const score = await calculatePresentedScoreSafe(farmer, effectiveInstitutionId)

  return {
    farmer,
    weights: score.weights,
    weightsSource: score.weightsSource,
    products: score.products,
    institutionId: score.institutionId,
    generatedAt: score.generatedAt,
    scoreResult: score.result,
    finalScore: score.finalScore,
    scoreStatus: score.status,
    riskLevel: score.riskLevel,
    scoreMax: score.scoreMax,
  }
}

async function calculatePresentedScoreSafe(
  farmer: DossierBundle['farmer'],
  institutionId?: string | null
) {
  try {
    return await calculatePresentedScore(farmer.id, institutionId)
  } catch (error) {
    console.error('[Dossier] Score fallback used:', error)

    return {
      result: createFallbackScoreResult(),
      finalScore: 0,
      weights: { c1: 30, c2: 25, c3: 25, c4: 20 },
      weightsSource: 'DEFAULT' as const,
      products: null,
      institutionId: institutionId ?? null,
      status: 'FAIBLE',
      riskLevel: 'HIGH' as const,
      scoreMax: 1000,
      generatedAt: new Date().toISOString(),
    }
  }
}

export function buildScoreExplanation(bundle: DossierBundle) {
  const { farmer, scoreResult, weights, weightsSource, finalScore, scoreStatus, riskLevel, scoreMax } = bundle
  const criticalAlertsCount = farmer.alerts.filter(alert => alert.severity === 'CRITICAL').length
  const warningAlertsCount = farmer.alerts.filter(alert => alert.severity === 'WARNING').length
  const ndviValues = farmer.parcelles
    .map(parcelle => parcelle.ndvi)
    .filter((value): value is number => value !== null && value !== undefined)
  const ndviAverage = ndviValues.length > 0
    ? roundToOneDecimal(ndviValues.reduce((sum, value) => sum + value, 0) / ndviValues.length)
    : null
  const hasPhoto = !!farmer.photoUrl
  const hasCni = !!farmer.cniUrl
  const hasAttestation = !!farmer.attestationUrl
  const hasCoop = !!farmer.cooperativeId
  const hasGps = farmer.lat !== 0 || farmer.lng !== 0
  const hasPolygon = farmer.parcelles.some(parcelle => !!parcelle.polygone)
  const hasParcels = farmer.parcelles.length > 0
  const hasActivities = farmer.activities.length > 0
  const recentActivities = farmer.activities.length >= 3

  const completedItems: string[] = []
  const missingRequiredItems: string[] = []
  const warnings: string[] = []

  collectChecklistItem(hasPhoto, 'Photo de profil', completedItems, missingRequiredItems)
  collectChecklistItem(hasCni, 'CNI', completedItems, missingRequiredItems)
  collectChecklistItem(hasAttestation, 'Attestation foncière', completedItems, missingRequiredItems)
  collectChecklistItem(hasCoop, 'Coopérative liée', completedItems, missingRequiredItems)
  collectChecklistItem(hasParcels, 'Au moins une parcelle déclarée', completedItems, missingRequiredItems)
  collectChecklistItem(hasGps, 'Coordonnées GPS farmer', completedItems, missingRequiredItems)

  if (hasPolygon) completedItems.push('Polygone parcellaire disponible')
  else warnings.push('Polygone parcellaire manquant')

  if (ndviAverage !== null) completedItems.push('NDVI disponible')
  else warnings.push('NDVI manquant')

  if (hasActivities) completedItems.push('Historique d’activités déclaré')
  else warnings.push('Aucune activité récente déclarée')

  if (criticalAlertsCount > 0) warnings.push('Alertes critiques actives')
  if (warningAlertsCount > 0) warnings.push('Alertes agronomiques à surveiller')

  const readinessScore = Math.round((completedItems.length / (completedItems.length + missingRequiredItems.length + Math.max(warnings.length, 1))) * 100)
  const confidenceLevel = getConfidenceLevel({
    hasPhoto,
    hasCni,
    hasAttestation,
    hasCoop,
    hasParcels,
    hasGps,
    hasPolygon,
    ndviAverage,
    recentActivities,
  })
  const readinessStatus = getReadinessStatus(missingRequiredItems.length, warnings.length, confidenceLevel)

  const missingData = [
    ...missingRequiredItems,
    ...(ndviAverage === null ? ['NDVI parcellaire'] : []),
    ...(!hasPolygon ? ['Polygone parcellaire'] : []),
    ...(!hasActivities ? ['Historique d’activités'] : []),
    ...(!farmer.historicCredit ? ['Historique de crédit déclaré'] : []),
  ]

  const nextBestActions = buildNextBestActions(missingData, criticalAlertsCount)
  const positiveFactors = buildPositiveFactors({
    finalScore,
    hasCoop,
    ndviAverage,
    criticalAlertsCount,
    hasPhoto,
    hasCni,
    hasAttestation,
    recentActivities,
    parcelCount: farmer.parcelles.length,
  })
  const riskFactors = buildRiskFactors({
    finalScore,
    criticalAlertsCount,
    warningAlertsCount,
    ndviAverage,
    hasCoop,
    hasActivities,
    hasCni,
    hasAttestation,
    hasParcels,
    historicCredit: farmer.historicCredit,
  })

  return {
    modelVersion: SCORE_MODEL_VERSION,
    confidenceLevel,
    readinessStatus,
    committeeReadiness: {
      status: readinessStatus,
      score: clampScore(readinessScore),
      missingRequiredItems,
      completedItems,
      warnings,
    },
    positiveFactors,
    riskFactors,
    missingData: uniqueStrings(missingData),
    nextBestActions,
    scoreBreakdown: {
      C1: {
        score: scoreResult.scoreC1,
        weight: weights.c1,
        label: 'Capacité',
        explanation: `Revenu estimé ${formatAmount(scoreResult.details.c1.revenuEstime)} sur ${roundToOneDecimal(scoreResult.details.c1.surfaceTotale)} ha.`,
      },
      C2: {
        score: scoreResult.scoreC2,
        weight: weights.c2,
        label: 'Caractère',
        explanation: `${scoreResult.details.c2.nbActivites} activité(s), ancienneté ${scoreResult.details.c2.anciennete} mois.`,
      },
      C3: {
        score: scoreResult.scoreC3,
        weight: weights.c3,
        label: 'Collatéral',
        explanation: `${countTrue([hasPhoto, hasCni, hasAttestation, hasGps, hasCoop, hasPolygon])}/6 éléments de collatéral complétés.`,
      },
      C4: {
        score: scoreResult.scoreC4,
        weight: weights.c4,
        label: 'Conditions',
        explanation: `${criticalAlertsCount} alerte(s) critique(s), NDVI moyen ${ndviAverage ?? 'n/d'}.`,
      },
    },
    weightsUsed: {
      weightC1: weights.c1,
      weightC2: weights.c2,
      weightC3: weights.c3,
      weightC4: weights.c4,
      source: weightsSource,
    },
    scoreStatus,
    riskLevel,
    scoreMax,
  }
}

export function buildDossierResponse(bundle: DossierBundle, authContext: AuthUserContext | null) {
  const explanation = buildScoreExplanation(bundle)
  const { farmer, generatedAt, finalScore, riskLevel, scoreMax, scoreResult, institutionId } = bundle
  const ndviValues = farmer.parcelles
    .map(parcelle => parcelle.ndvi)
    .filter((value): value is number => value !== null && value !== undefined)
  const ndviAverage = ndviValues.length > 0
    ? roundToOneDecimal(ndviValues.reduce((sum, value) => sum + value, 0) / ndviValues.length)
    : null
  const activeRequest = farmer.creditRequests.find(request =>
    request.statut !== 'REJETE' && request.statut !== 'REJECTED'
  ) ?? null

  return {
    dossierId: `dossier-${farmer.id}-${Date.now()}`,
    generatedAt,
    modelVersion: SCORE_MODEL_VERSION,
    complianceNotice: COMPLIANCE_NOTICE,
    farmer: {
      id: farmer.id,
      firstName: farmer.firstName,
      lastName: farmer.lastName,
      phone: farmer.phone,
      email: farmer.user?.email ?? undefined,
      region: farmer.region || undefined,
      village: farmer.village || undefined,
      lat: farmer.lat || undefined,
      lng: farmer.lng || undefined,
      onboardedAt: farmer.onboardedAt?.toISOString?.() ?? undefined,
      kycStatus: farmer.kycStatus ?? undefined,
      cooperativeId: farmer.cooperativeId ?? undefined,
    },
    cooperative: farmer.cooperative ? {
      id: farmer.cooperative.id,
      name: farmer.cooperative.name,
      region: farmer.cooperative.region,
      filiere: farmer.cooperative.filiere,
      rccm: farmer.cooperative.rccm,
      institutionId: farmer.cooperative.institutionId ?? undefined,
    } : null,
    kyc: {
      status: getKycStatus(farmer),
      hasPhoto: !!farmer.photoUrl,
      hasCni: !!farmer.cniUrl,
      hasAttestation: !!farmer.attestationUrl,
      documents: [
        buildDocumentEntry('PHOTO', farmer.photoUrl),
        buildDocumentEntry('CNI', farmer.cniUrl),
        buildDocumentEntry('ATTESTATION', farmer.attestationUrl),
      ],
      missingItems: explanation.committeeReadiness.missingRequiredItems.filter(item =>
        item === 'Photo de profil' || item === 'CNI' || item === 'Attestation foncière'
      ),
    },
    parcels: farmer.parcelles.map(parcelle => ({
      id: parcelle.id,
      name: parcelle.name,
      culture: parcelle.culture,
      superficie: parcelle.superficie,
      lat: parcelle.lat || undefined,
      lng: parcelle.lng || undefined,
      hasPolygon: !!parcelle.polygone,
      ndvi: parcelle.ndvi ?? undefined,
      statut: parcelle.statut ?? undefined,
      stade: parcelle.stade ?? undefined,
      datePlantation: parcelle.datePlantation?.toISOString?.() ?? undefined,
    })),
    agronomicMonitoring: {
      ndviAverage: ndviAverage ?? undefined,
      parcelCount: farmer.parcelles.length,
      criticalAlertsCount: farmer.alerts.filter(alert => alert.severity === 'CRITICAL').length,
      warningAlertsCount: farmer.alerts.filter(alert => alert.severity === 'WARNING').length,
      latestAlerts: farmer.alerts.slice(0, 5).map(alert => ({
        id: alert.id,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        createdAt: alert.createdAt.toISOString(),
      })),
    },
    credit: {
      activeRequest: activeRequest ? {
        id: activeRequest.id,
        statut: activeRequest.statut,
        montant: activeRequest.montant,
        montantAccorde: activeRequest.montantAccorde ?? undefined,
        createdAt: activeRequest.createdAt.toISOString(),
      } : undefined,
      historyCount: farmer.creditRequests.length,
      suggestedAmountMin: scoreResult.montantMinSuggere,
      suggestedAmountMax: scoreResult.montantMaxSuggere,
      productSuggested: scoreResult.produitSuggere,
    },
    score: {
      score: finalScore,
      scoreMax,
      riskLevel,
      readinessStatus: explanation.readinessStatus,
      confidenceLevel: explanation.confidenceLevel,
      scoreBreakdown: explanation.scoreBreakdown,
      positiveFactors: explanation.positiveFactors,
      riskFactors: explanation.riskFactors,
      missingData: explanation.missingData,
      nextBestActions: explanation.nextBestActions,
      weightsUsed: explanation.weightsUsed,
    },
    committeeReadiness: {
      status: explanation.committeeReadiness.status,
      score: explanation.committeeReadiness.score,
      completedItems: explanation.committeeReadiness.completedItems,
      missingRequiredItems: explanation.committeeReadiness.missingRequiredItems,
      warnings: explanation.committeeReadiness.warnings,
    },
    nonDecisioningRecommendation: COMPLIANCE_NOTICE,
    audit: {
      generatedByUserId: authContext?.userId ?? undefined,
      generatedByRole: authContext?.role ?? undefined,
      institutionId: authContext?.institutionId ?? institutionId ?? undefined,
      source: 'API' as const,
      version: DOSSIER_VERSION,
    },
  }
}

function createFallbackScoreResult(): WakamaScoreResult {
  return {
    score: 0,
    scoreC1: 0,
    scoreC2: 0,
    scoreC3: 0,
    scoreC4: 0,
    revenuEstime: 0,
    montantMinSuggere: 0,
    montantMaxSuggere: 0,
    produitSuggere: 'Aucun produit disponible',
    details: {
      c1: {
        revenuEstime: 0,
        surfaceTotale: 0,
        culturesPrincipales: [],
        score: 0,
      },
      c2: {
        anciennete: 0,
        nbActivites: 0,
        regulariteConnexion: 'N/A',
        score: 0,
      },
      c3: {
        hasPhoto: false,
        hasCni: false,
        hasAttestation: false,
        hasGps: false,
        hasCoop: false,
        hasPolygone: false,
        score: 0,
      },
      c4: {
        ndviMoyen: 0,
        nbAlertesCritiques: 0,
        filierePrincipale: 'Autre',
        coopCertifiee: false,
        score: 0,
      },
    },
    recommendations: ['Completer le dossier farmer pour generer un score plus fiable'],
    eligibilite: {
      remuci: false,
      baobabProduction: false,
      baobabCampagne: false,
      nsiaPackPaysan: false,
    },
  }
}

function getKycStatus(farmer: DossierBundle['farmer']) {
  if (farmer.kycStatus) return farmer.kycStatus
  return 'INCOMPLETE'
}

function buildDocumentEntry(type: string, url: string | null) {
  return {
    type,
    present: !!url,
    ...(url && { url }),
    ...(isPublicUploadUrl(url) && { publicUrlWarning: true }),
  }
}

function collectChecklistItem(
  condition: boolean,
  label: string,
  completedItems: string[],
  missingRequiredItems: string[]
) {
  if (condition) {
    completedItems.push(label)
    return
  }

  missingRequiredItems.push(label)
}

function getConfidenceLevel(input: {
  hasPhoto: boolean
  hasCni: boolean
  hasAttestation: boolean
  hasCoop: boolean
  hasParcels: boolean
  hasGps: boolean
  hasPolygon: boolean
  ndviAverage: number | null
  recentActivities: boolean
}) {
  const evidenceCount = countTrue([
    input.hasPhoto,
    input.hasCni,
    input.hasAttestation,
    input.hasCoop,
    input.hasParcels,
    input.hasGps,
    input.hasPolygon,
    input.ndviAverage !== null,
    input.recentActivities,
  ])

  if (evidenceCount >= 8) return 'HIGH' as const
  if (evidenceCount >= 5) return 'MEDIUM' as const
  return 'LOW' as const
}

function getReadinessStatus(
  missingRequiredCount: number,
  warningCount: number,
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'
) {
  if (missingRequiredCount > 0) return 'INCOMPLETE' as const
  if (warningCount > 0 || confidenceLevel !== 'HIGH') return 'READY_FOR_REVIEW' as const
  return 'COMMITTEE_READY' as const
}

function buildPositiveFactors(input: {
  finalScore: number
  hasCoop: boolean
  ndviAverage: number | null
  criticalAlertsCount: number
  hasPhoto: boolean
  hasCni: boolean
  hasAttestation: boolean
  recentActivities: boolean
  parcelCount: number
}) {
  const factors: string[] = []
  if (input.finalScore >= 600) factors.push('Score global favorable pour une revue institutionnelle')
  if (input.hasCoop) factors.push('Appartenance à une coopérative déclarée')
  if ((input.ndviAverage ?? 0) >= 0.4) factors.push('Vigueur végétale satisfaisante sur les parcelles')
  if (input.criticalAlertsCount === 0) factors.push('Aucune alerte critique ouverte')
  if (input.hasPhoto && input.hasCni && input.hasAttestation) {
    factors.push('KYC documentaire bien complété')
  }
  if (input.recentActivities) factors.push('Historique d’activités suffisant')
  if (input.parcelCount >= 2) factors.push('Patrimoine parcellaire diversifié')
  return factors
}

function buildRiskFactors(input: {
  finalScore: number
  criticalAlertsCount: number
  warningAlertsCount: number
  ndviAverage: number | null
  hasCoop: boolean
  hasActivities: boolean
  hasCni: boolean
  hasAttestation: boolean
  hasParcels: boolean
  historicCredit: string | null
}) {
  const factors: string[] = []
  if (input.finalScore < 400) factors.push('Score global encore faible')
  if (input.criticalAlertsCount > 0) factors.push('Présence d’alertes critiques agronomiques')
  if (input.warningAlertsCount > 0) factors.push('Présence d’alertes de vigilance')
  if (input.ndviAverage !== null && input.ndviAverage < 0.3) factors.push('NDVI moyen faible')
  if (!input.hasCoop) factors.push('Aucune coopérative liée')
  if (!input.hasActivities) factors.push('Historique d’activités insuffisant')
  if (!input.hasCni) factors.push('CNI manquante')
  if (!input.hasAttestation) factors.push('Attestation foncière manquante')
  if (!input.hasParcels) factors.push('Aucune parcelle déclarée')
  if (input.historicCredit?.toLowerCase().includes('difficult')) {
    factors.push('Historique de crédit signalé comme difficile')
  }
  return factors
}

function buildNextBestActions(missingData: string[], criticalAlertsCount: number) {
  const actions: string[] = []
  for (const item of uniqueStrings(missingData)) {
    if (item === 'Photo de profil') actions.push('Ajouter une photo de profil au dossier')
    else if (item === 'CNI') actions.push('Téléverser la CNI du farmer')
    else if (item === 'Attestation foncière') actions.push('Téléverser une attestation foncière')
    else if (item === 'Coopérative liée') actions.push('Rattacher le farmer à une coopérative')
    else if (item === 'Au moins une parcelle déclarée') actions.push('Déclarer au moins une parcelle')
    else if (item === 'Coordonnées GPS farmer') actions.push('Compléter les coordonnées GPS du farmer')
    else if (item === 'NDVI parcellaire') actions.push('Mettre à jour un NDVI sur au moins une parcelle')
    else if (item === 'Polygone parcellaire') actions.push('Tracer le polygone des parcelles')
    else if (item === 'Historique d’activités') actions.push('Déclarer les activités agricoles récentes')
    else if (item === 'Historique de crédit déclaré') actions.push('Compléter l’historique de crédit')
  }

  if (criticalAlertsCount > 0) {
    actions.push('Analyser et traiter les alertes critiques avant passage comité')
  }

  return uniqueStrings(actions)
}

function getScoreStatus(score: number) {
  if (score >= 700) return 'EXCELLENT'
  if (score >= 500) return 'BON'
  if (score >= 300) return 'MOYEN'
  return 'FAIBLE'
}

function getRiskLevel(score: number) {
  if (score >= 600) return 'LOW' as const
  if (score >= 400) return 'MEDIUM' as const
  return 'HIGH' as const
}

function countTrue(values: boolean[]) {
  return values.filter(Boolean).length
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10
}

function formatAmount(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} FCFA`
}

function isPublicUploadUrl(url: string | null) {
  if (!url) return false
  return url.startsWith('/uploads/') || url.includes('/uploads/')
}
