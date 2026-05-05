import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../generated/prisma/index.js'

const prisma = new PrismaClient()

const DEMO_EMAIL = 'admin@baobab-demo.wakama'
const PASSWORD_ENV = 'BAOBAB_DEMO_PASSWORD'

async function main() {
  const password = process.env[PASSWORD_ENV]
  if (!password) {
    console.error(`[Script] Missing ${PASSWORD_ENV}. Set it before running this script.`)
    process.exitCode = 1
    return
  }

  const institution = await prisma.institution.findFirst({
    where: { name: { contains: 'Baobab', mode: 'insensitive' } },
    select: { id: true, name: true },
  })

  if (!institution) {
    console.error('[Script] No institution with "Baobab" in its name found.')
    process.exitCode = 1
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { role: 'INSTITUTION_ADMIN', passwordHash },
    create: { email: DEMO_EMAIL, passwordHash, role: 'INSTITUTION_ADMIN' },
    select: { id: true, email: true, role: true },
  })

  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: user.id, institutionId: institution.id } },
    update: { role: 'ADMIN' },
    create: { userId: user.id, institutionId: institution.id, role: 'ADMIN' },
  })

  console.log('[Script] Success')
  console.log(`  email:            ${user.email}`)
  console.log(`  role:             ${user.role}`)
  console.log(`  institution name: ${institution.name}`)
  console.log(`  institution id:   ${institution.id}`)
  console.log(`  institution role: ADMIN`)
}

main()
  .catch((error) => {
    console.error('[Script] Failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
