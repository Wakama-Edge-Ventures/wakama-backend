import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/index.js'

const prisma = new PrismaClient()

async function main() {
  const requestedFarmerId = process.env.FARMER_ID

  const farmerSelect = {
    id: true,
    firstName: true,
    lastName: true,
    cooperativeId: true,
  }

  let farmer
  if (requestedFarmerId) {
    console.log(`[Script] FARMER_ID requested: ${requestedFarmerId}`)
    farmer = await prisma.farmer.findUnique({ where: { id: requestedFarmerId }, select: farmerSelect })
    if (!farmer) {
      console.error(`[Script] Farmer not found: ${requestedFarmerId}`)
      process.exit(1)
    }
  } else {
    farmer = await prisma.farmer.findFirst({ orderBy: { onboardedAt: 'asc' }, select: farmerSelect })
  }

  const institution = await prisma.institution.findFirst({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
    },
  })

  if (!farmer) {
    console.error('[Script] No farmer found. Create a farmer first.')
    process.exitCode = 1
    return
  }

  if (!institution) {
    console.error('[Script] No institution found. Create an institution first.')
    process.exitCode = 1
    return
  }

  let cooperative = await prisma.cooperative.findFirst({
    orderBy: { foundedAt: 'asc' },
    select: {
      id: true,
      name: true,
      rccm: true,
      institutionId: true,
    },
  })

  if (!cooperative) {
    cooperative = await prisma.cooperative.create({
      data: {
        id: `coop-link-${Date.now()}`,
        name: 'Cooperative Test Institution Link',
        rccm: `RCCM-LINK-${Date.now()}`,
        region: 'Test Region',
        filiere: 'Test Filiere',
        surface: 0,
        foundedAt: new Date(),
        lat: 0,
        lng: 0,
        institutionId: institution.id,
      },
      select: {
        id: true,
        name: true,
        rccm: true,
        institutionId: true,
      },
    })

    console.log(`[Script] Cooperative created: ${cooperative.name} (${cooperative.id})`)
  }

  if (requestedFarmerId) {
    console.log(`[Script] FARMER_ID matched: ${farmer.id}`)
  }
  console.log(
    `[Script] Farmer used: ${farmer.firstName} ${farmer.lastName} (${farmer.id})`
  )
  console.log(`[Script] Cooperative used: ${cooperative.name} (${cooperative.id})`)
  console.log(
    `[Script] Institution used: ${institution.name} (${institution.id}) [${institution.type}]`
  )

  if (cooperative.institutionId !== institution.id) {
    cooperative = await prisma.cooperative.update({
      where: { id: cooperative.id },
      data: { institutionId: institution.id },
      select: {
        id: true,
        name: true,
        rccm: true,
        institutionId: true,
      },
    })
  }

  if (farmer.cooperativeId !== cooperative.id) {
    await prisma.farmer.update({
      where: { id: farmer.id },
      data: { cooperativeId: cooperative.id },
    })
  }

  console.log(
    `[Script] Linked farmer ${farmer.id} -> cooperative ${cooperative.id} -> institution ${institution.id}`
  )
  console.log('[Script] Farmer should now be visible to the institution context.')
}

main()
  .catch((error) => {
    console.error('[Script] Failed to link farmer to institution:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
