import 'dotenv/config'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'

const PILOT_INSTITUTION_NAME = 'Wakama Assurance Maroc Pilot'
const PILOT_INSTITUTION_TYPE = 'ASSURANCE'
const PILOT_INSTITUTION_COUNTRY = 'MA'
const PILOT_INSTITUTION_MODULES = ['assurance', 'insurance', 'rax', 'missions', 'monitoring', 'evidence']

const PILOT_ADMIN_EMAIL = 'assurance-admin@wakama.farm'
const PILOT_ADMIN_ROLE = 'INSTITUTION_ADMIN'
const PILOT_LINK_ROLE = 'ADMIN'

const PASSWORD_ENV_KEY = 'SEED_ASSURANCE_ADMIN_PASSWORD'
const LOCAL_DEV_FALLBACK_PASSWORD = 'WakamaAssurance@2026'

function resolveSeedPassword() {
  const configured = process.env[PASSWORD_ENV_KEY]?.trim()
  if (configured) return configured

  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase()
  const isProduction = nodeEnv === 'production'
  if (isProduction) {
    throw new Error(`[Seed] Missing ${PASSWORD_ENV_KEY} in production environment.`)
  }

  console.warn(
    `[Seed] ${PASSWORD_ENV_KEY} not set. Using local-development fallback password for ${PILOT_ADMIN_EMAIL}.`
  )
  return LOCAL_DEV_FALLBACK_PASSWORD
}

async function upsertPilotInstitution() {
  const existing = await prisma.institution.findFirst({
    where: { name: PILOT_INSTITUTION_NAME },
    orderBy: { createdAt: 'asc' },
  })

  if (existing) {
    const updated = await prisma.institution.update({
      where: { id: existing.id },
      data: {
        type: PILOT_INSTITUTION_TYPE,
        country: PILOT_INSTITUTION_COUNTRY,
        modules: PILOT_INSTITUTION_MODULES,
        active: true,
      },
    })
    return { institution: updated, created: false }
  }

  const created = await prisma.institution.create({
    data: {
      name: PILOT_INSTITUTION_NAME,
      type: PILOT_INSTITUTION_TYPE,
      country: PILOT_INSTITUTION_COUNTRY,
      modules: PILOT_INSTITUTION_MODULES,
      active: true,
    },
  })
  return { institution: created, created: true }
}

async function upsertPilotInstitutionAdmin(passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email: PILOT_ADMIN_EMAIL },
    update: {
      role: PILOT_ADMIN_ROLE,
      passwordHash,
    },
    create: {
      email: PILOT_ADMIN_EMAIL,
      role: PILOT_ADMIN_ROLE,
      passwordHash,
    },
  })
  return user
}

async function main() {
  console.log('[Seed] Starting assurance pilot institution admin seed...')
  const password = resolveSeedPassword()
  const passwordHash = await bcrypt.hash(password, 10)

  const { institution, created } = await upsertPilotInstitution()
  console.log(
    created
      ? `[Seed] Institution created: ${institution.name} (${institution.id})`
      : `[Seed] Institution refreshed: ${institution.name} (${institution.id})`
  )

  const user = await upsertPilotInstitutionAdmin(passwordHash)
  console.log(`[Seed] User ready: ${user.email} (${user.id})`)

  await prisma.institutionUser.upsert({
    where: {
      userId_institutionId: {
        userId: user.id,
        institutionId: institution.id,
      },
    },
    update: {
      role: PILOT_LINK_ROLE,
    },
    create: {
      userId: user.id,
      institutionId: institution.id,
      role: PILOT_LINK_ROLE,
    },
  })

  console.log(`[Seed] Link ready: ${user.email} -> ${institution.name} (${PILOT_LINK_ROLE})`)
  console.log('[Seed] Assurance pilot institution admin seed complete.')
}

main()
  .catch((error) => {
    console.error('[Seed] Assurance pilot institution admin seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

