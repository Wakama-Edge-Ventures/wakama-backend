import prisma from '../lib/prisma.js'
import type { AuthUserContext } from '../types/auth.js'

export function isReadOnlyInstitutionUser(context: AuthUserContext): boolean {
  return (
    (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') &&
    context.institutionRole === 'READONLY'
  )
}

export async function canAccessFarmer(
  context: AuthUserContext,
  farmerId: string
): Promise<boolean | null> {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: {
      id: true,
      cooperativeId: true,
      cooperative: { select: { institutionId: true } },
    },
  })

  if (!farmer) return null
  if (context.role === 'SUPERADMIN') return true
  if (context.role === 'FARMER') return context.farmerId === farmer.id
  if (context.role === 'COOP_ADMIN') {
    return !!context.cooperativeId && farmer.cooperativeId === context.cooperativeId
  }

  if (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') {
    return !!context.institutionId && farmer.cooperative?.institutionId === context.institutionId
  }

  return false
}

export async function canAccessCooperative(
  context: AuthUserContext,
  coopId: string
): Promise<boolean | null> {
  const cooperative = await prisma.cooperative.findUnique({
    where: { id: coopId },
    select: {
      id: true,
      adminUserId: true,
      institutionId: true,
    },
  })

  if (!cooperative) return null
  if (context.role === 'SUPERADMIN') return true
  if (context.role === 'COOP_ADMIN') {
    return context.cooperativeId === cooperative.id || cooperative.adminUserId === context.userId
  }

  if (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') {
    return !!context.institutionId && cooperative.institutionId === context.institutionId
  }

  return false
}

export async function canAccessParcelle(
  context: AuthUserContext,
  parcelleId: string
): Promise<boolean | null> {
  const parcelle = await prisma.parcelle.findUnique({
    where: { id: parcelleId },
    select: {
      id: true,
      farmerId: true,
      farmer: {
        select: {
          cooperativeId: true,
        },
      },
    },
  })

  if (!parcelle) return null
  if (context.role === 'SUPERADMIN') return true
  if (context.role === 'FARMER') return context.farmerId === parcelle.farmerId
  if (context.role === 'COOP_ADMIN') {
    return !!context.cooperativeId && parcelle.farmer.cooperativeId === context.cooperativeId
  }

  return false
}

export async function canAccessCreditRequest(
  context: AuthUserContext,
  creditRequestId: string
): Promise<boolean | null> {
  const creditRequest = await prisma.creditRequest.findUnique({
    where: { id: creditRequestId },
    select: {
      id: true,
      farmerId: true,
      farmer: {
        select: {
          cooperativeId: true,
          cooperative: { select: { institutionId: true } },
        },
      },
    },
  })

  if (!creditRequest) return null
  if (context.role === 'SUPERADMIN') return true
  if (context.role === 'FARMER') return context.farmerId === creditRequest.farmerId
  if (context.role === 'COOP_ADMIN') {
    return (
      !!context.cooperativeId &&
      creditRequest.farmer.cooperativeId === context.cooperativeId
    )
  }

  if (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') {
    return (
      !!context.institutionId &&
      creditRequest.farmer.cooperative?.institutionId === context.institutionId
    )
  }

  return false
}

export async function canAccessAlert(
  context: AuthUserContext,
  alertId: string
): Promise<boolean | null> {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: {
      id: true,
      farmerId: true,
      coopId: true,
      farmer: {
        select: {
          cooperativeId: true,
          cooperative: { select: { institutionId: true } },
        },
      },
      cooperative: {
        select: {
          institutionId: true,
        },
      },
    },
  })

  if (!alert) return null
  if (context.role === 'SUPERADMIN') return true

  if (alert.farmerId) {
    if (context.role === 'FARMER') return context.farmerId === alert.farmerId
    if (context.role === 'COOP_ADMIN') {
      return !!context.cooperativeId && alert.farmer?.cooperativeId === context.cooperativeId
    }
    if (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') {
      return (
        !!context.institutionId &&
        alert.farmer?.cooperative?.institutionId === context.institutionId
      )
    }
  }

  if (alert.coopId) {
    if (context.role === 'COOP_ADMIN') return context.cooperativeId === alert.coopId
    if (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') {
      return !!context.institutionId && alert.cooperative?.institutionId === context.institutionId
    }
  }

  return false
}

export async function canAccessCreditDecision(
  context: AuthUserContext,
  creditDecisionId: string
): Promise<boolean | null> {
  const decision = await prisma.creditDecision.findUnique({
    where: { id: creditDecisionId },
    select: {
      id: true,
      institutionId: true,
      farmerId: true,
      farmer: {
        select: {
          cooperative: { select: { institutionId: true } },
        },
      },
    },
  })

  if (!decision) return null
  if (context.role === 'SUPERADMIN') return true
  if (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') {
    return (
      !!context.institutionId &&
      decision.institutionId === context.institutionId &&
      decision.farmer.cooperative?.institutionId === context.institutionId
    )
  }

  return false
}
