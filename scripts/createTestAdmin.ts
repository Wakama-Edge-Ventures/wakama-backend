import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../generated/prisma/index.js'

const prisma = new PrismaClient()

const TEST_ADMIN_EMAIL = 'admin@wakama.test'
const TEST_ADMIN_PASSWORD_ENV = 'TEST_ADMIN_PASSWORD'

async function main() {
  const testAdminPassword = process.env[TEST_ADMIN_PASSWORD_ENV]
  if (!testAdminPassword) {
    console.error(
      `[Script] Missing ${TEST_ADMIN_PASSWORD_ENV}. ` +
      `Set it before running this script.`
    )
    process.exitCode = 1
    return
  }

  const institution = await prisma.institution.findFirst({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
    },
  })

  if (!institution) {
    console.error('[Script] No institution found. Create an institution first.')
    process.exitCode = 1
    return
  }

  console.log(
    `[Script] Using institution: ${institution.name} (${institution.id}) [${institution.type}]`
  )

  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_ADMIN_EMAIL },
    select: {
      id: true,
      email: true,
      role: true,
    },
  })

  const passwordHash = await bcrypt.hash(testAdminPassword, 10)

  const user = existingUser
    ? await prisma.user.update({
        where: { email: TEST_ADMIN_EMAIL },
        data: {
          role: 'INSTITUTION_ADMIN',
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          role: true,
        },
      })
    : await prisma.user.create({
        data: {
          email: TEST_ADMIN_EMAIL,
          passwordHash,
          role: 'INSTITUTION_ADMIN',
        },
        select: {
          id: true,
          email: true,
          role: true,
        },
      })

  console.log(
    existingUser
      ? `[Script] User already existed and was refreshed: ${user.email} (${user.id})`
      : `[Script] User created: ${user.email} (${user.id})`
  )

  const existingLink = await prisma.institutionUser.findUnique({
    where: {
      userId_institutionId: {
        userId: user.id,
        institutionId: institution.id,
      },
    },
    select: {
      id: true,
    },
  })

  await prisma.institutionUser.upsert({
    where: {
      userId_institutionId: {
        userId: user.id,
        institutionId: institution.id,
      },
    },
    update: {
      role: 'ADMIN',
    },
    create: {
      userId: user.id,
      institutionId: institution.id,
      role: 'ADMIN',
    },
  })

  console.log(
    existingLink
      ? `[Script] Institution link already existed and was kept on role ADMIN.`
      : `[Script] Institution link created with role ADMIN.`
  )

  console.log('[Script] Test institution admin is ready.')
}

main()
  .catch((error) => {
    console.error('[Script] Failed to create test institution admin:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
