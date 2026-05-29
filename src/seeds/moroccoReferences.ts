import prisma from '../lib/prisma.js'

const MANUAL_SOURCE = 'MANUAL_ESTIMATE_PHASE_27A_2026'

async function seedMoroccoReferences() {
  console.log('[Seed][Morocco] Seeding reference data...')

  const province = await prisma.moroccoProvince.upsert({
    where: { name: 'Larache' },
    update: {
      region: 'Tanger-Tétouan-Al Hoceïma',
      source: MANUAL_SOURCE,
    },
    create: {
      name: 'Larache',
      region: 'Tanger-Tétouan-Al Hoceïma',
      source: MANUAL_SOURCE,
    },
  })

  await prisma.moroccoCommune.upsert({
    where: {
      provinceId_name: {
        provinceId: province.id,
        name: 'Ksar El-Kébir',
      },
    },
    update: {
      lat: 35.0017,
      lng: -5.9038,
      source: MANUAL_SOURCE,
    },
    create: {
      name: 'Ksar El-Kébir',
      provinceId: province.id,
      lat: 35.0017,
      lng: -5.9038,
      source: MANUAL_SOURCE,
    },
  })

  await prisma.moroccoDam.upsert({
    where: { name: 'Oued El Makhazine' },
    update: {
      basin: 'Loukkos',
      province: 'Larache',
      commune: 'Ksar El-Kébir',
      lat: 35.003,
      lng: -5.732,
      sourceType: 'MANUAL',
      confidence: 'MEDIUM',
      sourceUrl: null,
      riverName: 'Oued Loukkos',
      operator: 'UNKNOWN_MANUAL',
    },
    create: {
      name: 'Oued El Makhazine',
      arabicName: null,
      basin: 'Loukkos',
      province: 'Larache',
      commune: 'Ksar El-Kébir',
      lat: 35.003,
      lng: -5.732,
      capacityMm3: null,
      riverName: 'Oued Loukkos',
      operator: 'UNKNOWN_MANUAL',
      sourceUrl: null,
      sourceType: 'MANUAL',
      confidence: 'MEDIUM',
    },
  })

  await prisma.moroccoRiverSegment.upsert({
    where: { name: 'Loukkos / Oued Loukkos (Pilot Segment)' },
    update: {
      basin: 'Loukkos',
      geometryGeojson: null,
      lat: 35.02,
      lng: -5.9,
      sourceType: 'MANUAL',
      confidence: 'MEDIUM',
    },
    create: {
      name: 'Loukkos / Oued Loukkos (Pilot Segment)',
      basin: 'Loukkos',
      geometryGeojson: null,
      lat: 35.02,
      lng: -5.9,
      sourceType: 'MANUAL',
      confidence: 'MEDIUM',
    },
  })

  await prisma.moroccoFloodRiskZone.upsert({
    where: { name: 'Ksar El-Kébir - Loukkos Plain Pilot Zone' },
    update: {
      province: 'Larache',
      commune: 'Ksar El-Kébir',
      basin: 'Loukkos',
      geometryGeojson: null,
      riskLevel: 'MEDIUM',
      reason: 'Pilot manual estimate for flood-prone lowland around Loukkos plain',
      sourceType: 'MANUAL',
      confidence: 'MEDIUM',
    },
    create: {
      name: 'Ksar El-Kébir - Loukkos Plain Pilot Zone',
      province: 'Larache',
      commune: 'Ksar El-Kébir',
      basin: 'Loukkos',
      geometryGeojson: null,
      riskLevel: 'MEDIUM',
      reason: 'Pilot manual estimate for flood-prone lowland around Loukkos plain',
      sourceType: 'MANUAL',
      confidence: 'MEDIUM',
    },
  })

  const cropCategories = [
    { code: 'BLE_DUR', labelFr: 'Ble dur', labelAr: 'القمح الصلب', family: 'CEREALES' },
    { code: 'BLE_TENDRE', labelFr: 'Ble tendre', labelAr: 'القمح الطري', family: 'CEREALES' },
    { code: 'ORGE', labelFr: 'Orge', labelAr: 'الشعير', family: 'CEREALES' },
    { code: 'MAIS', labelFr: 'Mais', labelAr: 'الذرة', family: 'CEREALES' },
    { code: 'OLIVIER', labelFr: 'Olivier', labelAr: 'الزيتون', family: 'ARBORICULTURE' },
    { code: 'AGRUMES', labelFr: 'Agrumes', labelAr: 'الحمضيات', family: 'ARBORICULTURE' },
    { code: 'MARAICHAGE', labelFr: 'Maraichage', labelAr: 'الخضروات', family: 'HORTICULTURE' },
    { code: 'LEGUMINEUSES', labelFr: 'Legumineuses', labelAr: 'البقوليات', family: 'CEREALES' },
  ]

  for (const category of cropCategories) {
    await prisma.insuranceCropCategory.upsert({
      where: {
        country_code: {
          country: 'MA',
          code: category.code,
        },
      },
      update: {
        labelFr: category.labelFr,
        labelAr: category.labelAr,
        family: category.family,
        defaultRiskLevel: 'MEDIUM',
        active: true,
      },
      create: {
        country: 'MA',
        code: category.code,
        labelFr: category.labelFr,
        labelAr: category.labelAr,
        family: category.family,
        defaultRiskLevel: 'MEDIUM',
        active: true,
      },
    })
  }

  console.log('[Seed][Morocco] Done.')
}

// Run manually: npx tsx src/seeds/moroccoReferences.ts
seedMoroccoReferences().catch(console.error).finally(() => prisma.$disconnect())
