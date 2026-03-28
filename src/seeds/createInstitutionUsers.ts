import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'

const INSTITUTION_ADMINS = [
  { name: 'Baobab CI',             email: 'admin@baobab-ci.com' },
  { name: 'UNACOOPEC-CI',          email: 'admin@unacoopec.ci' },
  { name: 'REMUCI',                email: 'admin@remuci.ci' },
  { name: 'Advans CI',             email: 'admin@advans-ci.com' },
  { name: 'NSIA Banque',           email: 'admin@nsia.ci' },
  { name: 'Ecobank CI',            email: 'admin@ecobank-ci.com' },
  { name: 'Atlantique Assurances', email: 'admin@atlantique-assurances.ci' },
  { name: 'AXA CI',                email: 'admin@axa-ci.com' },
  { name: 'Wakama Demo',           email: 'admin@wakama.farm' },
]

async function createInstitutionUsers() {
  console.log('[Seed] Creating institution admin users...')

  const passwordHash = await bcrypt.hash('Wakama@2026', 10)

  for (const entry of INSTITUTION_ADMINS) {
    const institution = await prisma.institution.findFirst({
      where: { name: entry.name }
    })

    if (!institution) {
      console.warn(`[Seed] Institution not found: ${entry.name} — skipping`)
      continue
    }

    // Upsert user by email
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: {},
      create: {
        email: entry.email,
        passwordHash,
        role: 'INSTITUTION_ADMIN',
      },
    })

    console.log(`[Seed] User: ${entry.email} (${user.id})`)

    // Upsert InstitutionUser on compound unique (userId, institutionId)
    await prisma.institutionUser.upsert({
      where: {
        userId_institutionId: {
          userId: user.id,
          institutionId: institution.id,
        },
      },
      update: { role: 'ADMIN' },
      create: {
        userId: user.id,
        institutionId: institution.id,
        role: 'ADMIN',
      },
    })

    console.log(`[Seed] Linked ${entry.email} → ${entry.name}`)
  }

  console.log('[Seed] Done.')
}

// Run directly: npx tsx src/seeds/createInstitutionUsers.ts
createInstitutionUsers().catch(console.error).finally(() => prisma.$disconnect())
