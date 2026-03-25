import prisma from './prisma.js'

// Official CI market prices (FCFA/kg)
const PRIX_MARCHE: Record<string, number> = {
  'Cacao': 1800,
  'Café': 1500,
  'Anacarde': 315,
  'Hévéa': 800,
  'Palmier à huile': 200,
  'Coton': 300,
  'Maïs': 150,
  'Riz': 250,
  'Manioc': 100,
  'Igname': 200,
  'Soja': 300,
  'Arachide': 350,
  'Tomate': 400,
  'Oignon': 300,
  'Banane': 150,
  'Plantain': 200,
  'Mangue': 250,
  'Ananas': 200,
  'Haricot': 400,
  'Niébé': 350,
}

// Average yield (kg/ha)
const RENDEMENT_MOYEN: Record<string, number> = {
  'Cacao': 500,
  'Café': 400,
  'Anacarde': 800,
  'Hévéa': 1200,
  'Palmier à huile': 8000,
  'Coton': 1200,
  'Maïs': 1500,
  'Riz': 2000,
  'Manioc': 8000,
  'Igname': 6000,
  'Soja': 1200,
  'Arachide': 1000,
  'Tomate': 15000,
  'Oignon': 12000,
  'Banane': 10000,
  'Plantain': 8000,
  'Mangue': 5000,
  'Ananas': 20000,
  'Haricot': 800,
  'Niébé': 700,
}

// Filière category score
function getFiliereScore(culture: string): number {
  const rente = ['Cacao', 'Café', 'Anacarde', 'Hévéa', 'Palmier à huile', 'Coton']
  const cereales = ['Maïs', 'Riz', 'Sorgho', 'Mil', 'Blé', 'Fonio']
  const vivrier = ['Manioc', 'Igname', 'Taro', 'Patate douce', 'Plantain']
  const maraicher = ['Tomate', 'Oignon', 'Poivron', 'Aubergine', 'Gombo', 'Chou', 'Laitue', 'Carotte']

  if (rente.includes(culture)) return 1.0
  if (cereales.includes(culture)) return 0.8
  if (vivrier.includes(culture)) return 0.7
  if (maraicher.includes(culture)) return 0.6
  return 0.5
}

export interface WakamaScoreResult {
  score: number
  scoreC1: number
  scoreC2: number
  scoreC3: number
  scoreC4: number

  revenuEstime: number
  montantMinSuggere: number
  montantMaxSuggere: number
  produitSuggere: string

  details: {
    c1: {
      revenuEstime: number
      surfaceTotale: number
      culturesPrincipales: string[]
      score: number
    }
    c2: {
      anciennete: number
      nbActivites: number
      regulariteConnexion: string
      score: number
    }
    c3: {
      hasPhoto: boolean
      hasCni: boolean
      hasAttestation: boolean
      hasGps: boolean
      hasCoop: boolean
      hasPolygone: boolean
      score: number
    }
    c4: {
      ndviMoyen: number
      nbAlertesCritiques: number
      filierePrincipale: string
      coopCertifiee: boolean
      score: number
    }
  }

  recommendations: string[]
  eligibilite: {
    remuci: boolean
    baobabProduction: boolean
    baobabCampagne: boolean
    nsiaPackPaysan: boolean
  }
}

export async function calculateWakamaScore(farmerId: string): Promise<WakamaScoreResult> {
  const [farmer, parcelles, activities, alerts] = await Promise.all([
    prisma.farmer.findUnique({
      where: { id: farmerId },
      include: { cooperative: true }
    }),
    prisma.parcelle.findMany({ where: { farmerId } }),
    prisma.activity.findMany({
      where: { farmerId },
      orderBy: { date: 'desc' }
    }),
    prisma.alert.findMany({
      where: { farmerId, severity: 'CRITICAL', read: false }
    }),
  ])

  if (!farmer) throw new Error('Farmer not found')

  // ==========================================
  // C1 — CAPACITÉ (30% of final score)
  // ==========================================

  let revenuEstime = 0
  const culturesPrincipales: string[] = []

  for (const parcelle of parcelles) {
    const culture = parcelle.culture ?? 'Maïs'
    const surface = parcelle.superficie ?? 0
    const prix = PRIX_MARCHE[culture] ?? 150
    const rendement = RENDEMENT_MOYEN[culture] ?? 1000
    revenuEstime += surface * rendement * prix
    if (!culturesPrincipales.includes(culture)) culturesPrincipales.push(culture)
  }

  const surfaceTotale = parcelles.reduce((sum, p) => sum + (p.superficie ?? 0), 0)

  let scoreC1Raw = 0
  if (revenuEstime >= 5000000) scoreC1Raw = 100
  else if (revenuEstime >= 3000000) scoreC1Raw = 80
  else if (revenuEstime >= 1000000) scoreC1Raw = 60
  else if (revenuEstime >= 500000) scoreC1Raw = 40
  else if (revenuEstime > 0) scoreC1Raw = 20
  else scoreC1Raw = 0

  // ==========================================
  // C2 — CARACTÈRE (25% of final score)
  // ==========================================

  const onboardedAt = farmer.onboardedAt ?? new Date()
  const ancienneteMonths = Math.floor(
    (Date.now() - onboardedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
  )

  let ancienneteScore = 0
  if (ancienneteMonths >= 24) ancienneteScore = 40
  else if (ancienneteMonths >= 12) ancienneteScore = 30
  else if (ancienneteMonths >= 6) ancienneteScore = 20
  else if (ancienneteMonths >= 1) ancienneteScore = 10
  else ancienneteScore = 5

  const nbActivites = activities.length

  let activitesScore = 0
  if (nbActivites >= 10) activitesScore = 40
  else if (nbActivites >= 6) activitesScore = 30
  else if (nbActivites >= 3) activitesScore = 20
  else if (nbActivites >= 1) activitesScore = 10
  else activitesScore = 0

  let experienceScore = 0
  const exp = farmer.experienceAnnees ?? ''
  if (exp.includes('10')) experienceScore = 20
  else if (exp.includes('6')) experienceScore = 15
  else if (exp.includes('3')) experienceScore = 10
  else if (exp.includes('1')) experienceScore = 5
  else experienceScore = 2

  let creditBonus = 0
  const hc = farmer.historicCredit ?? ''
  if (hc.includes('correctement')) creditBonus = 10
  else if (hc.includes('difficultés')) creditBonus = -10
  else if (hc.includes('refusé')) creditBonus = -5

  const scoreC2Raw = Math.min(100,
    ancienneteScore + activitesScore + experienceScore + creditBonus
  )

  // ==========================================
  // C3 — COLLATÉRAL (25% of final score)
  // ==========================================

  let scoreC3Raw = 0
  const hasPhoto = !!farmer.photoUrl
  const hasCni = !!farmer.cniUrl
  const hasAttestation = !!farmer.attestationUrl
  const hasGps = !!(farmer.lat && farmer.lng && farmer.lat !== 0)
  const hasCoop = !!farmer.cooperativeId
  const hasPolygone = parcelles.some(p => !!p.polygone)

  if (hasPhoto) scoreC3Raw += 10
  if (hasCni) scoreC3Raw += 25
  if (hasAttestation) scoreC3Raw += 30
  if (hasGps) scoreC3Raw += 10
  if (hasCoop) scoreC3Raw += 15
  if (hasPolygone) scoreC3Raw += 10

  // ==========================================
  // C4 — CONDITIONS (20% of final score)
  // ==========================================

  const parcellesWithNdvi = parcelles.filter(p => p.ndvi !== null && p.ndvi !== undefined)
  const ndviMoyen = parcellesWithNdvi.length > 0
    ? parcellesWithNdvi.reduce((sum, p) => sum + (p.ndvi ?? 0), 0) / parcellesWithNdvi.length
    : 0

  let ndviScore = 0
  if (ndviMoyen >= 0.6) ndviScore = 40
  else if (ndviMoyen >= 0.4) ndviScore = 30
  else if (ndviMoyen >= 0.2) ndviScore = 20
  else if (ndviMoyen > 0) ndviScore = 10
  else ndviScore = 0

  const nbAlertesCritiques = alerts.length
  const alertesMalus = Math.min(nbAlertesCritiques * 5, 20)

  const filierePrincipale = culturesPrincipales[0] ?? 'Autre'
  const filiereScore = Math.round(getFiliereScore(filierePrincipale) * 30)

  const coopCertifiee = !!(farmer.cooperative as any)?.certification &&
    (farmer.cooperative as any)?.certification !== 'Aucune certification'
  const coopBonus = coopCertifiee ? 20 : hasCoop ? 10 : 0

  const scoreC4Raw = Math.max(0, Math.min(100,
    ndviScore + filiereScore + coopBonus - alertesMalus
  ))

  // ==========================================
  // FINAL WAKAMA SCORE
  // ==========================================

  const scoreWeighted = (
    scoreC1Raw * 0.30 +
    scoreC2Raw * 0.25 +
    scoreC3Raw * 0.25 +
    scoreC4Raw * 0.20
  )

  const score = Math.round(scoreWeighted * 10) // 0-1000

  // ==========================================
  // MONTANT SUGGÉRÉ
  // ==========================================

  const capaciteRemboursement = revenuEstime * 0.35 * (score / 1000)
  const montantMinSuggere = Math.max(100000, Math.round(capaciteRemboursement * 0.3))
  const montantMaxSuggere = Math.min(20000000, Math.round(capaciteRemboursement))

  let produitSuggere = 'Aucun produit disponible'
  if (score >= 700) produitSuggere = 'NSIA Pack Paysan ou Baobab Agri Campagne'
  else if (score >= 600) produitSuggere = 'Baobab Agri Campagne'
  else if (score >= 400) produitSuggere = 'Baobab Agri Production'
  else if (score >= 300) produitSuggere = 'REMUCI Crédit Agricole'
  else produitSuggere = 'Complétez votre profil pour accéder au crédit'

  // ==========================================
  // RECOMMENDATIONS
  // ==========================================

  const recommendations: string[] = []
  if (!hasCni) recommendations.push('Uploadez votre CNI pour +25 points sur le collatéral')
  if (!hasAttestation) recommendations.push('Ajoutez votre attestation foncière pour +30 points')
  if (!hasPolygone) recommendations.push('Dessinez le polygone de vos parcelles pour un score GPS précis')
  if (ndviMoyen < 0.3) recommendations.push("Actualisez votre NDVI satellite pour refléter l'état réel de vos cultures")
  if (nbActivites < 3) recommendations.push('Déclarez vos activités agricoles régulièrement (+activités = +score caractère)')
  if (!hasCoop) recommendations.push('Rejoignez une coopérative pour +15 points collatéral et accès aux lignes bancaires')
  if (revenuEstime === 0) recommendations.push('Ajoutez vos parcelles avec les cultures pour calculer votre capacité de remboursement')

  return {
    score,
    scoreC1: scoreC1Raw,
    scoreC2: scoreC2Raw,
    scoreC3: scoreC3Raw,
    scoreC4: scoreC4Raw,
    revenuEstime,
    montantMinSuggere,
    montantMaxSuggere,
    produitSuggere,
    details: {
      c1: { revenuEstime, surfaceTotale, culturesPrincipales, score: scoreC1Raw },
      c2: { anciennete: ancienneteMonths, nbActivites, regulariteConnexion: 'Récent', score: scoreC2Raw },
      c3: { hasPhoto, hasCni, hasAttestation, hasGps, hasCoop, hasPolygone, score: scoreC3Raw },
      c4: { ndviMoyen, nbAlertesCritiques, filierePrincipale, coopCertifiee, score: scoreC4Raw }
    },
    recommendations,
    eligibilite: {
      remuci: score >= 300,
      baobabProduction: score >= 400,
      baobabCampagne: score >= 600,
      nsiaPackPaysan: score >= 700
    }
  }
}
