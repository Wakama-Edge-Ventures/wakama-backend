import prisma from '../lib/prisma.js'

const INSTITUTIONS = [
  { name: 'Baobab CI',             type: 'MFI',       modules: ['scoring', 'credits', 'ndvi', 'analytics'] },
  { name: 'UNACOOPEC-CI',          type: 'MFI',       modules: ['scoring', 'credits', 'ndvi'] },
  { name: 'REMUCI',                type: 'MFI',       modules: ['scoring', 'credits'] },
  { name: 'Advans CI',             type: 'MFI',       modules: ['scoring', 'credits', 'ndvi', 'analytics'] },
  { name: 'NSIA Banque',           type: 'BANQUE',    modules: ['scoring', 'credits', 'ndvi', 'analytics', 'iot'] },
  { name: 'Ecobank CI',            type: 'BANQUE',    modules: ['scoring', 'credits', 'ndvi', 'analytics'] },
  { name: 'Atlantique Assurances', type: 'ASSURANCE', modules: ['scoring', 'ndvi', 'climate', 'iot'] },
  { name: 'AXA CI',                type: 'ASSURANCE', modules: ['scoring', 'ndvi', 'climate'] },
  { name: 'Wakama Demo',           type: 'MFI',       modules: ['scoring', 'credits', 'ndvi', 'analytics', 'iot'] },
]

export async function seedInstitutions() {
  console.log('[Seed] Seeding institutions...')

  for (const inst of INSTITUTIONS) {
    const existing = await prisma.institution.findFirst({ where: { name: inst.name } })
    if (!existing) {
      await prisma.institution.create({
        data: { name: inst.name, type: inst.type, modules: inst.modules }
      })
      console.log(`[Seed] Created: ${inst.name}`)
    } else {
      console.log(`[Seed] Already exists: ${inst.name}`)
    }
  }

  console.log('[Seed] Institutions done.')
}

// Run directly: npx tsx src/seeds/institutions.ts
seedInstitutions().catch(console.error).finally(() => prisma.$disconnect())
