import prisma from '../lib/prisma.js'
import { getPinataConfigStatus } from '../lib/evidence/pinata.js'
import { getSolanaConfigStatus } from '../lib/evidence/solana.js'

const SEED_SOURCE = 'SEED_DEMO'
const MANUAL_SOURCE = 'MANUAL_ESTIMATE'

type WriteCounter = Record<string, { created: number; updated: number }>

function shouldWrite(args: Set<string>): boolean {
  return args.has('--write')
}

async function upsertNonUnique<TRecord extends { id: string }>(
  key: string,
  counter: WriteCounter,
  findExisting: () => Promise<TRecord | null>,
  create: () => Promise<TRecord>,
  update: (record: TRecord) => Promise<TRecord>
) {
  const existing = await findExisting()
  if (!existing) {
    await create()
    counter[key] = counter[key] ?? { created: 0, updated: 0 }
    counter[key].created += 1
    return
  }

  await update(existing)
  counter[key] = counter[key] ?? { created: 0, updated: 0 }
  counter[key].updated += 1
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const writeMode = shouldWrite(args)
  const mode = writeMode ? 'WRITE' : 'DRY_RUN'
  const counters: WriteCounter = {}

  const geography = {
    region: {
      country: 'MA',
      code: 'MA-TTAH',
      nameFr: 'Tanger-Tetouan-Al Hoceima',
      nameAr: null,
      source: MANUAL_SOURCE,
      confidence: 'MEDIUM',
    },
    province: {
      name: 'Larache',
      nameFr: 'Larache',
      nameAr: null,
      code: 'MA-LAR',
      country: 'MA',
      region: 'Tanger-Tetouan-Al Hoceima',
      source: MANUAL_SOURCE,
      confidence: 'MEDIUM',
    },
    commune: {
      name: 'Ksar El-Kebir',
      nameFr: 'Ksar El-Kebir',
      nameAr: null,
      code: 'MA-LAR-KEBIR',
      country: 'MA',
      regionCode: 'MA-TTAH',
      lat: 35.0017,
      lng: -5.9038,
      source: MANUAL_SOURCE,
      confidence: 'MEDIUM',
    },
    city: {
      country: 'MA',
      nameFr: 'Ksar El Kebir',
      nameAr: null,
      lat: 35.0017,
      lng: -5.9038,
      source: MANUAL_SOURCE,
      confidence: 'MEDIUM',
    },
  }

  const crops = [
    { code: 'BLE_DUR', labelFr: 'Ble dur', labelAr: null, family: 'CEREALES', cropFamily: 'CEREALS' },
    { code: 'BLE_TENDRE', labelFr: 'Ble tendre', labelAr: null, family: 'CEREALES', cropFamily: 'CEREALS' },
    { code: 'ORGE', labelFr: 'Orge', labelAr: null, family: 'CEREALES', cropFamily: 'CEREALS' },
    { code: 'MAIS', labelFr: 'Mais', labelAr: null, family: 'CEREALES', cropFamily: 'CEREALS' },
    { code: 'OLIVIER', labelFr: 'Olivier', labelAr: null, family: 'ARBORICULTURE', cropFamily: 'ARBORICULTURE' },
    { code: 'AGRUMES', labelFr: 'Agrumes', labelAr: null, family: 'ARBORICULTURE', cropFamily: 'ARBORICULTURE' },
    { code: 'MARAICHAGE', labelFr: 'Maraichage', labelAr: null, family: 'HORTICULTURE', cropFamily: 'HORTICULTURE' },
    { code: 'LEGUMINEUSES', labelFr: 'Legumineuses', labelAr: null, family: 'LEGUMES_SECS', cropFamily: 'LEGUMES_SECS' },
  ]

  const seasons = [
    {
      cropCode: 'BLE_DUR',
      cropLabelFr: 'Ble dur',
      regionCode: 'MA-TTAH',
      agroZoneCode: 'MA-LOUKKOS',
      sowingStartMonth: 10,
      sowingEndMonth: 12,
      harvestStartMonth: 5,
      harvestEndMonth: 7,
      irrigationWindowJson: '{"recommended":["11","12","01","02"]}',
      riskWindowJson: '{"frost":["12","01","02"],"drought":["03","04","05"]}',
      source: MANUAL_SOURCE,
      confidence: 'LOW',
    },
    {
      cropCode: 'BLE_TENDRE',
      cropLabelFr: 'Ble tendre',
      regionCode: 'MA-TTAH',
      agroZoneCode: 'MA-LOUKKOS',
      sowingStartMonth: 10,
      sowingEndMonth: 12,
      harvestStartMonth: 5,
      harvestEndMonth: 7,
      irrigationWindowJson: '{"recommended":["11","12","01","02"]}',
      riskWindowJson: '{"frost":["12","01","02"],"drought":["03","04","05"]}',
      source: MANUAL_SOURCE,
      confidence: 'LOW',
    },
    {
      cropCode: 'MARAICHAGE',
      cropLabelFr: 'Maraichage',
      regionCode: 'MA-TTAH',
      agroZoneCode: 'MA-IRRIGATED-PERIMETER',
      sowingStartMonth: 9,
      sowingEndMonth: 3,
      harvestStartMonth: 11,
      harvestEndMonth: 8,
      irrigationWindowJson: '{"recommended":["all_year"]}',
      riskWindowJson: '{"pest":["03","04","05","09","10"],"heat":["06","07","08"]}',
      source: MANUAL_SOURCE,
      confidence: 'MEDIUM',
    },
    {
      cropCode: 'OLIVIER',
      cropLabelFr: 'Olivier',
      regionCode: 'MA-TTAH',
      agroZoneCode: 'MA-NORTH-ATLANTIC',
      sowingStartMonth: 11,
      sowingEndMonth: 2,
      harvestStartMonth: 10,
      harvestEndMonth: 12,
      irrigationWindowJson: '{"recommended":["03","04","05","06"]}',
      riskWindowJson: '{"frost":["12","01"],"drought":["06","07","08"]}',
      source: MANUAL_SOURCE,
      confidence: 'LOW',
    },
  ]

  const agroZones = [
    {
      country: 'MA',
      code: 'MA-LOUKKOS',
      nameFr: 'Zone Loukkos',
      nameAr: null,
      description: 'Zone pilote de la plaine du Loukkos (estimation technique).',
      regionCode: 'MA-TTAH',
      rainfallBand: 'MEDIUM_TO_HIGH',
      dominantCropsJson: '["BLE_DUR","BLE_TENDRE","MARAICHAGE","AGRUMES"]',
      source: MANUAL_SOURCE,
      confidence: 'MEDIUM',
    },
    {
      country: 'MA',
      code: 'MA-NORTH-ATLANTIC',
      nameFr: 'Zone Nord Atlantique',
      nameAr: null,
      description: 'Zone nord atlantique de reference (estimation).',
      regionCode: 'MA-TTAH',
      rainfallBand: 'MEDIUM',
      dominantCropsJson: '["OLIVIER","AGRUMES","ORGE"]',
      source: MANUAL_SOURCE,
      confidence: 'LOW',
    },
    {
      country: 'MA',
      code: 'MA-IRRIGATED-PERIMETER',
      nameFr: 'Perimetre irrigue pilote',
      nameAr: null,
      description: 'Perimetres irrigues pilotes, donnees non officielles.',
      regionCode: 'MA-TTAH',
      rainfallBand: 'VARIABLE',
      dominantCropsJson: '["MARAICHAGE","MAIS","AGRUMES"]',
      source: MANUAL_SOURCE,
      confidence: 'LOW',
    },
  ]

  const riskZones = [
    {
      country: 'MA',
      code: 'RZ-FLOOD-LOUKKOS',
      nameFr: 'Risque inondation Loukkos',
      riskType: 'FLOOD',
      regionCode: 'MA-TTAH',
      provinceCode: 'MA-LAR',
      communeCode: 'MA-LAR-KEBIR',
      lat: 35.0,
      lng: -5.89,
      radiusKm: 20,
      geometryJson: null,
      severityDefault: 4,
      frequencyDefault: 4,
      source: MANUAL_SOURCE,
      confidence: 'MEDIUM',
    },
    {
      country: 'MA',
      code: 'RZ-DROUGHT-CEREALS',
      nameFr: 'Stress hydrique cereales',
      riskType: 'DROUGHT',
      regionCode: 'MA-TTAH',
      provinceCode: null,
      communeCode: null,
      lat: null,
      lng: null,
      radiusKm: null,
      geometryJson: null,
      severityDefault: 4,
      frequencyDefault: 3,
      source: MANUAL_SOURCE,
      confidence: 'LOW',
    },
    {
      country: 'MA',
      code: 'RZ-FROST-HIGHLAND',
      nameFr: 'Gel precoce zone altitude',
      riskType: 'FROST',
      regionCode: null,
      provinceCode: null,
      communeCode: null,
      lat: null,
      lng: null,
      radiusKm: null,
      geometryJson: null,
      severityDefault: 3,
      frequencyDefault: 2,
      source: MANUAL_SOURCE,
      confidence: 'LOW',
    },
    {
      country: 'MA',
      code: 'RZ-HAIL-GENERIC',
      nameFr: 'Grele risque generique',
      riskType: 'HAIL',
      regionCode: null,
      provinceCode: null,
      communeCode: null,
      lat: null,
      lng: null,
      radiusKm: null,
      geometryJson: null,
      severityDefault: 3,
      frequencyDefault: 2,
      source: MANUAL_SOURCE,
      confidence: 'LOW',
    },
    {
      country: 'MA',
      code: 'RZ-HEATWAVE-GENERIC',
      nameFr: 'Canicule risque generique',
      riskType: 'HEAT',
      regionCode: null,
      provinceCode: null,
      communeCode: null,
      lat: null,
      lng: null,
      radiusKm: null,
      geometryJson: null,
      severityDefault: 4,
      frequencyDefault: 3,
      source: MANUAL_SOURCE,
      confidence: 'LOW',
    },
    {
      country: 'MA',
      code: 'RZ-PEST-DISEASE-GENERIC',
      nameFr: 'Risque ravageurs et maladies',
      riskType: 'PEST',
      regionCode: null,
      provinceCode: null,
      communeCode: null,
      lat: null,
      lng: null,
      radiusKm: null,
      geometryJson: null,
      severityDefault: 3,
      frequencyDefault: 3,
      source: MANUAL_SOURCE,
      confidence: 'LOW',
    },
  ]

  const threats = [
    ['TH_DROUGHT', 'CLIMATE', 'Secheresse', 5, 4],
    ['TH_FLOOD', 'HYDRO', 'Inondation', 5, 4],
    ['TH_FROST', 'CLIMATE', 'Gel', 4, 2],
    ['TH_HAIL', 'CLIMATE', 'Grele', 4, 2],
    ['TH_HEAT', 'CLIMATE', 'Canicule', 4, 3],
    ['TH_PEST', 'BIOLOGICAL', 'Ravageurs', 3, 3],
    ['TH_DISEASE', 'BIOLOGICAL', 'Maladies', 4, 3],
    ['TH_WILDFIRE', 'CLIMATE', 'Incendie', 5, 1],
    ['TH_GOVERNANCE_WEAKNESS', 'GOVERNANCE', 'Faiblesse de gouvernance', 3, 3],
    ['TH_LOW_DETECTION', 'OPERATIONAL', 'Faible capacite de detection', 3, 4],
  ] as const

  const vulnerabilities = [
    ['VU_NO_IRRIGATION', 'MATERIAL', 'Pas dirrigation', 1.0, 5],
    ['VU_FLOOD_ZONE', 'GEOGRAPHIC', 'Zone inondable', 1.0, 4],
    ['VU_OLD_EQUIPMENT', 'MATERIAL', 'Equipements anciens', 0.7, 3],
    ['VU_NO_PLANNING', 'GOVERNANCE', 'Pas de planification', 0.8, 4],
    ['VU_LOW_TECH_MONITORING', 'DETECTION', 'Faible monitoring technologique', 1.0, 5],
    ['VU_CROP_SENSITIVE', 'AGRONOMIC', 'Culture sensible', 0.9, 3],
    ['VU_INCOMPLETE_DOCS', 'GOVERNANCE', 'Documents incomplets', 0.6, 4],
    ['VU_LOW_GPS_CERTAINTY', 'DETECTION', 'Faible certitude GPS', 0.7, 4],
    ['VU_AGENT_AUDIT_PENDING', 'OPERATIONAL', 'Audit agent en attente', 0.8, 4],
  ] as const

  const scenarios = [
    {
      threatCode: 'TH_DROUGHT',
      vulnerabilityCode: 'VU_NO_IRRIGATION',
      cropCode: 'BLE_DUR',
      regionCode: 'MA-TTAH',
      baseGravity: 5,
      baseFrequency: 4,
      baseDetection: 4,
      notes: 'drought x no irrigation x cereals',
    },
    {
      threatCode: 'TH_FLOOD',
      vulnerabilityCode: 'VU_FLOOD_ZONE',
      cropCode: 'BLE_TENDRE',
      regionCode: 'MA-TTAH',
      baseGravity: 5,
      baseFrequency: 4,
      baseDetection: 3,
      notes: 'flood x flood zone x Loukkos',
    },
    {
      threatCode: 'TH_PEST',
      vulnerabilityCode: 'VU_CROP_SENSITIVE',
      cropCode: 'MARAICHAGE',
      regionCode: 'MA-TTAH',
      baseGravity: 4,
      baseFrequency: 3,
      baseDetection: 3,
      notes: 'pest x crop sensitive x maraichage',
    },
    {
      threatCode: 'TH_FROST',
      vulnerabilityCode: 'VU_CROP_SENSITIVE',
      cropCode: 'OLIVIER',
      regionCode: null,
      baseGravity: 3,
      baseFrequency: 2,
      baseDetection: 3,
      notes: 'frost x crop sensitive x arboriculture',
    },
    {
      threatCode: 'TH_LOW_DETECTION',
      vulnerabilityCode: 'VU_LOW_TECH_MONITORING',
      cropCode: null,
      regionCode: null,
      baseGravity: 3,
      baseFrequency: 4,
      baseDetection: 5,
      notes: 'low detection x no IoT/NDVI',
    },
  ]

  const claimCauses = [
    ['CLAIM_DROUGHT', 'DROUGHT', 'Secheresse', false, 4],
    ['CLAIM_FLOOD', 'FLOOD', 'Inondation', true, 5],
    ['CLAIM_FROST', 'FROST', 'Gel', false, 3],
    ['CLAIM_HAIL', 'HAIL', 'Grele', false, 3],
    ['CLAIM_PEST', 'PEST', 'Ravageurs', false, 3],
    ['CLAIM_DISEASE', 'DISEASE', 'Maladies', false, 3],
    ['CLAIM_WILDFIRE', 'FIRE', 'Incendie', false, 5],
    ['CLAIM_HEAT_STRESS', 'HEAT', 'Stress thermique', false, 4],
    ['CLAIM_OTHER', 'OTHER', 'Autres causes', false, 2],
  ] as const

  const claimStatuses = [
    ['ALERT_TRIGGERED', 'Alerte declenchee', 10],
    ['CLAIM_OPENED', 'Sinistre ouvert', 20],
    ['INVESTIGATION', 'Investigation', 30],
    ['INDEMNIFICATION_APPROVED', 'Indemnisation approuvee', 40],
    ['PAID', 'Paye', 50],
    ['CLOSED', 'Cloture', 60],
    ['REJECTED', 'Rejete', 70],
    ['SECURITY_HOLD', 'Blocage securite', 80],
  ] as const

  const thresholds = [
    ['NDVI_DROP_WARNING', 'Baisse NDVI alerte', 'NDVI_DROP', 'LTE', null, -0.2, null, 7, 'WARNING'],
    ['NDVI_DROP_CRITICAL', 'Baisse NDVI critique', 'NDVI_DROP', 'LTE', null, -0.35, null, 7, 'CRITICAL'],
    ['RAINFALL_DEFICIT_WARNING', 'Deficit pluie alerte', 'RAINFALL_ANOMALY', 'LTE', null, -30, null, 14, 'WARNING'],
    ['HEAVY_RAIN_FLOOD_WARNING', 'Pluie intense inondation', 'RAINFALL_ANOMALY', 'GTE', 60, null, null, 3, 'CRITICAL'],
    ['FROST_TEMP_WARNING', 'Alerte gel', 'TEMP_MIN', 'LTE', 1, null, null, 2, 'WARNING'],
    ['HEATWAVE_WARNING', 'Alerte canicule', 'TEMP_MAX', 'GTE', 40, null, null, 3, 'CRITICAL'],
  ] as const

  const gravityScaleJson = '{"1":"Tres faible","2":"Faible","3":"Moyen","4":"Eleve","5":"Critique"}'
  const frequencyScaleJson = '{"1":"Rare","2":"Peu frequent","3":"Saisonnier","4":"Frequent","5":"Tres frequent"}'
  const detectionScaleJson =
    '{"1":{"label":"Tres bonne detection","multiplier":0.2},"2":{"label":"Bonne detection","multiplier":0.4},"3":{"label":"Detection moyenne","multiplier":0.6},"4":{"label":"Detection faible","multiplier":0.8},"5":{"label":"Aucune detection","multiplier":1.0}}'
  const tierRulesJson =
    '{"LOW_RISK":{"min":0,"max":20},"MEDIUM_RISK":{"min":21,"max":50},"HIGH_RISK":{"min":51,"max":75},"UNINSURABLE":{"min":76,"max":100}}'

  if (writeMode) {
    const region = await prisma.moroccoRegion.upsert({
      where: { code: geography.region.code },
      update: geography.region,
      create: geography.region,
    })
    counters.geography = { created: 0, updated: 1 }

    const province = await prisma.moroccoProvince.upsert({
      where: { name: geography.province.name },
      update: { ...geography.province, regionId: region.id },
      create: { ...geography.province, regionId: region.id },
    })

    await prisma.moroccoCommune.upsert({
      where: { provinceId_name: { provinceId: province.id, name: geography.commune.name } },
      update: { ...geography.commune, provinceId: province.id },
      create: { ...geography.commune, provinceId: province.id },
    })

    const commune = await prisma.moroccoCommune.findFirst({
      where: { provinceId: province.id, name: geography.commune.name },
    })

    await upsertNonUnique(
      'cities',
      counters,
      () =>
        prisma.moroccoCity.findFirst({
          where: {
            country: geography.city.country,
            nameFr: geography.city.nameFr,
            provinceId: province.id,
            communeId: commune?.id ?? null,
          },
        }),
      () =>
        prisma.moroccoCity.create({
          data: { ...geography.city, provinceId: province.id, communeId: commune?.id ?? null },
        }),
      (existing) =>
        prisma.moroccoCity.update({
          where: { id: existing.id },
          data: { ...geography.city, provinceId: province.id, communeId: commune?.id ?? null },
        })
    )

    for (const crop of crops) {
      await prisma.insuranceCropCategory.upsert({
        where: { country_code: { country: 'MA', code: crop.code } },
        update: {
          labelFr: crop.labelFr,
          labelAr: crop.labelAr,
          family: crop.family,
          cropFamily: crop.cropFamily,
          source: MANUAL_SOURCE,
          confidence: 'MEDIUM',
          active: true,
        },
        create: {
          country: 'MA',
          code: crop.code,
          labelFr: crop.labelFr,
          labelAr: crop.labelAr,
          family: crop.family,
          cropFamily: crop.cropFamily,
          source: MANUAL_SOURCE,
          confidence: 'MEDIUM',
          active: true,
        },
      })
    }

    for (const zone of agroZones) {
      await prisma.moroccoAgroClimaticZone.upsert({
        where: { code: zone.code },
        update: zone,
        create: zone,
      })
    }

    for (const season of seasons) {
      await upsertNonUnique(
        'cropSeasons',
        counters,
        () =>
          prisma.moroccoCropSeason.findFirst({
            where: {
              country: 'MA',
              cropCode: season.cropCode,
              regionCode: season.regionCode,
              agroZoneCode: season.agroZoneCode,
            },
          }),
        () => prisma.moroccoCropSeason.create({ data: { country: 'MA', ...season } }),
        (existing) => prisma.moroccoCropSeason.update({ where: { id: existing.id }, data: season })
      )
    }

    for (const zone of riskZones) {
      await prisma.moroccoRiskZone.upsert({
        where: { code: zone.code },
        update: zone,
        create: zone,
      })
    }

    for (const [code, category, labelFr, defaultGravity, defaultFrequency] of threats) {
      await prisma.threatCatalog.upsert({
        where: { code },
        update: {
          country: 'MA',
          category,
          labelFr,
          defaultGravity,
          defaultFrequency,
          isActive: true,
          source: SEED_SOURCE,
          confidence: 'MEDIUM',
        },
        create: {
          code,
          country: 'MA',
          category,
          labelFr,
          defaultGravity,
          defaultFrequency,
          isActive: true,
          source: SEED_SOURCE,
          confidence: 'MEDIUM',
        },
      })
    }

    for (const [code, category, labelFr, defaultWeight, defaultDetectionScore] of vulnerabilities) {
      await prisma.vulnerabilityCatalog.upsert({
        where: { code },
        update: {
          country: 'MA',
          category,
          labelFr,
          defaultWeight,
          defaultDetectionScore,
          isActive: true,
          source: SEED_SOURCE,
          confidence: 'MEDIUM',
        },
        create: {
          code,
          country: 'MA',
          category,
          labelFr,
          defaultWeight,
          defaultDetectionScore,
          isActive: true,
          source: SEED_SOURCE,
          confidence: 'MEDIUM',
        },
      })
    }

    for (const scenario of scenarios) {
      await upsertNonUnique(
        'riskScenarios',
        counters,
        () =>
          prisma.riskMatrixScenario.findFirst({
            where: {
              country: 'MA',
              threatCode: scenario.threatCode,
              vulnerabilityCode: scenario.vulnerabilityCode,
              cropCode: scenario.cropCode,
              regionCode: scenario.regionCode,
            },
          }),
        () => prisma.riskMatrixScenario.create({ data: { country: 'MA', ...scenario, source: SEED_SOURCE, confidence: 'MEDIUM', isActive: true } }),
        (existing) =>
          prisma.riskMatrixScenario.update({
            where: { id: existing.id },
            data: { ...scenario, source: SEED_SOURCE, confidence: 'MEDIUM', isActive: true },
          })
      )
    }

    await prisma.raxParameterSet.upsert({
      where: { country_name_version: { country: 'MA', name: 'RAX_MA_PILOT', version: 'v1' } },
      update: {
        isActive: false,
        gravityScaleJson,
        frequencyScaleJson,
        detectionScaleJson,
        tierRulesJson,
        formula: 'RAX_BRUT=G*F*D;WRS=(RAX_BRUT/25)*100',
        source: SEED_SOURCE,
      },
      create: {
        country: 'MA',
        name: 'RAX_MA_PILOT',
        version: 'v1',
        isActive: false,
        gravityScaleJson,
        frequencyScaleJson,
        detectionScaleJson,
        tierRulesJson,
        formula: 'RAX_BRUT=G*F*D;WRS=(RAX_BRUT/25)*100',
        source: SEED_SOURCE,
      },
    })

    for (const [code, category, labelFr, parametricEligible, defaultSeverity] of claimCauses) {
      await prisma.insuranceClaimCause.upsert({
        where: { code },
        update: {
          country: 'MA',
          labelFr,
          category,
          parametricEligible,
          defaultSeverity,
          source: SEED_SOURCE,
          confidence: 'MEDIUM',
          active: true,
        },
        create: {
          country: 'MA',
          code,
          labelFr,
          category,
          parametricEligible,
          defaultSeverity,
          source: SEED_SOURCE,
          confidence: 'MEDIUM',
          active: true,
        },
      })
    }

    for (const [code, labelFr, sortOrder] of claimStatuses) {
      await prisma.insuranceClaimStatusCatalog.upsert({
        where: { code },
        update: { labelFr, sortOrder, active: true },
        create: { code, labelFr, sortOrder, active: true },
      })
    }

    for (const [code, labelFr, metric, operator, value, valueMin, valueMax, durationDays, severity] of thresholds) {
      await prisma.insuranceAlertThreshold.upsert({
        where: { code },
        update: {
          country: 'MA',
          labelFr,
          metric,
          operator,
          value,
          valueMin,
          valueMax,
          durationDays,
          severity,
          source: SEED_SOURCE,
          active: true,
        },
        create: {
          country: 'MA',
          code,
          labelFr,
          metric,
          operator,
          value,
          valueMin,
          valueMax,
          durationDays,
          severity,
          source: SEED_SOURCE,
          active: true,
        },
      })
    }

    await prisma.insurancePricingParameterSet.upsert({
      where: { country_name_version: { country: 'MA', name: 'MA_TECH_PRICING_DEMO', version: 'v1' } },
      update: {
        isActive: false,
        cropCode: null,
        regionCode: 'MA-TTAH',
        baseRatePercent: 6.5,
        minPremium: 120,
        maxCoverageRatio: 0.75,
        deductibleRulesJson: '{"defaultPct":10}',
        wrsLoadingRulesJson: '{"LOW_RISK":0,"MEDIUM_RISK":8,"HIGH_RISK":15,"UNINSURABLE":100}',
        notes: 'Technical demo parameters only; insurer validates final commercial premium and issuance.',
        source: SEED_SOURCE,
        confidence: 'LOW',
      },
      create: {
        country: 'MA',
        name: 'MA_TECH_PRICING_DEMO',
        version: 'v1',
        isActive: false,
        cropCode: null,
        regionCode: 'MA-TTAH',
        baseRatePercent: 6.5,
        minPremium: 120,
        maxCoverageRatio: 0.75,
        deductibleRulesJson: '{"defaultPct":10}',
        wrsLoadingRulesJson: '{"LOW_RISK":0,"MEDIUM_RISK":8,"HIGH_RISK":15,"UNINSURABLE":100}',
        notes: 'Technical demo parameters only; insurer validates final commercial premium and issuance.',
        source: SEED_SOURCE,
        confidence: 'LOW',
      },
    })

    await prisma.insuranceTaxFeeParameterSet.upsert({
      where: { country_name_version: { country: 'MA', name: 'MA_TECH_TAX_FEE_DEMO', version: 'v1' } },
      update: {
        isActive: false,
        taxRatePercent: 14,
        wakamaServiceFeePercent: 2.5,
        insurerFeePercent: 1.5,
        brokerFeePercent: 1,
        notes: 'Technical reference only; insurer validates final commercial distribution and fees.',
        source: SEED_SOURCE,
        confidence: 'LOW',
      },
      create: {
        country: 'MA',
        name: 'MA_TECH_TAX_FEE_DEMO',
        version: 'v1',
        isActive: false,
        taxRatePercent: 14,
        wakamaServiceFeePercent: 2.5,
        insurerFeePercent: 1.5,
        brokerFeePercent: 1,
        notes: 'Technical reference only; insurer validates final commercial distribution and fees.',
        source: SEED_SOURCE,
        confidence: 'LOW',
      },
    })
  }

  const pinata = getPinataConfigStatus()
  const solana = getSolanaConfigStatus()

  console.log(`[Seed][MoroccoInsuranceBackbone] Mode: ${mode}`)
  console.log(`geography rows: 4`)
  console.log(`crop rows: ${crops.length}`)
  console.log(`crop season rows: ${seasons.length}`)
  console.log(`agro-climatic zone rows: ${agroZones.length}`)
  console.log(`risk zone rows: ${riskZones.length}`)
  console.log(`threat rows: ${threats.length}`)
  console.log(`vulnerability rows: ${vulnerabilities.length}`)
  console.log(`scenario rows: ${scenarios.length}`)
  console.log(`claim cause rows: ${claimCauses.length}`)
  console.log(`claim status rows: ${claimStatuses.length}`)
  console.log(`alert threshold rows: ${thresholds.length}`)
  console.log(`parameter set rows: 4`)
  console.log(
    `evidence config status: pinataUploadEnabled=${pinata.pinataUploadEnabled} anchoringEnabled=${solana.anchoringEnabled} solanaCluster=${solana.cluster}`
  )
  if (writeMode) {
    console.log('[Seed][MoroccoInsuranceBackbone] Write counters:')
    for (const [key, row] of Object.entries(counters)) {
      console.log(`- ${key}: created=${row.created}, updated=${row.updated}`)
    }
  } else {
    console.log('[Seed][MoroccoInsuranceBackbone] Dry-run only. No database write executed.')
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
