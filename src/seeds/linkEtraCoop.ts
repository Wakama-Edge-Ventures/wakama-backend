import prisma from '../lib/prisma.js'

async function linkEtraCoopToRemuci() {
  console.log('[Seed] Linking ETRA coop to REMUCI institution...')

  const remuci = await prisma.institution.findFirst({
    where: { name: { contains: 'REMUCI' } }
  })

  if (!remuci) {
    console.error('[Seed] REMUCI institution not found. Run src/seeds/institutions.ts first.')
    return
  }

  console.log(`[Seed] Found REMUCI: ${remuci.id}`)

  // Try by known id first, fall back to name search
  const coop = await prisma.cooperative.findFirst({
    where: {
      OR: [
        { id: 'coop-etra-001' },
        { name: { contains: 'ETRA', mode: 'insensitive' } },
      ]
    }
  })

  if (!coop) {
    console.error('[Seed] ETRA cooperative not found.')
    return
  }

  console.log(`[Seed] Found coop: ${coop.name} (${coop.id})`)

  await prisma.cooperative.update({
    where: { id: coop.id },
    data: { institutionId: remuci.id }
  })

  console.log(`[Seed] Linked "${coop.name}" → REMUCI (${remuci.id})`)
}

linkEtraCoopToRemuci().catch(console.error).finally(() => prisma.$disconnect())
