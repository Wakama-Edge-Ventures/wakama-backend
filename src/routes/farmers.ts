import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { buildDossierResponse, loadDossierBundle } from '../lib/institutionalScoring.js'
import { maskMoroccoCin, maskMoroccoPhone, canViewSensitivePii } from '../lib/pii.js'
import { getUserContext, optionalAuth, verifyToken } from '../middleware/auth.js'
import { canAccessFarmer } from '../middleware/ownership.js'
import { asObject, hasDefinedValue, hasForbiddenKey } from '../lib/validation.js'

const MOROCCO_COUNTRY = 'MA'
const MOROCCO_PHONE_REGEX = /^(?:\+212|0)[5-7]\d{8}$/
const MOROCCO_CIN_REGEX = /^[A-Z]{1,2}[0-9]{5,8}$/i

function normalizeCountry(value: unknown, fallback = 'CI'): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toUpperCase()
  return normalized || fallback
}

function normalizeMoroccoPhone(phone: string): string {
  const compact = phone.replace(/\s+/g, '')
  if (compact.startsWith('0')) {
    return `+212${compact.slice(1)}`
  }
  return compact
}

function parseDateMaybe(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = new Date(value as string)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function shouldShowSensitive(context: Awaited<ReturnType<typeof getUserContext>>, farmerId: string): boolean {
  return canViewSensitivePii({
    role: context?.role,
    farmerId: context?.farmerId,
    targetFarmerId: farmerId,
    institutionId: context?.institutionId,
    hasInstitutionContext: false,
  })
}

function sanitizeFarmerForRead(farmer: any, allowSensitive: boolean) {
  if (allowSensitive) return farmer

  return {
    ...farmer,
    phone: maskMoroccoPhone(farmer.phone),
    cin: maskMoroccoCin(farmer.cin),
    moroccoPhoneNormalized: null,
    cniUrl: null,
    attestationUrl: null,
  }
}

function minimalPublicFarmerProfile(farmer: any) {
  return {
    id: farmer.id,
    firstName: farmer.firstName,
    lastName: farmer.lastName,
    phone: maskMoroccoPhone(farmer.phone),
    country: farmer.country ?? 'CI',
    region: farmer.region,
    province: farmer.province,
    commune: farmer.commune,
    village: farmer.village,
    lat: farmer.lat,
    lng: farmer.lng,
    surface: farmer.surface,
    photoUrl: farmer.photoUrl,
    cooperative: farmer.cooperative ?? null,
    kycStatus: farmer.kycStatus,
    onboardedAt: farmer.onboardedAt,
  }
}

function validateMoroccoInputs(input: {
  country: string
  phone?: string | null
  cin?: string | null
  cndpConsent?: boolean
}) {
  if (input.country !== MOROCCO_COUNTRY) return { ok: true as const }

  if (input.cndpConsent !== true) {
    return { ok: false as const, error: 'CNDP consent is required for Morocco records' }
  }

  if (input.phone) {
    const compact = input.phone.replace(/\s+/g, '')
    if (!MOROCCO_PHONE_REGEX.test(compact)) {
      return { ok: false as const, error: 'Invalid Morocco phone format' }
    }
  }

  if (input.cin && !MOROCCO_CIN_REGEX.test(input.cin.trim())) {
    return { ok: false as const, error: 'Invalid Morocco CIN format' }
  }

  return { ok: true as const }
}

export default async function farmersRoutes(fastify: FastifyInstance) {
  // GET /v1/farmers
  fastify.get('/', { preHandler: optionalAuth }, async (request, reply) => {
    const { page = '1', limit = '20', search, region, cooperativeId } = request.query as {
      page?: string
      limit?: string
      search?: string
      region?: string
      cooperativeId?: string
    }

    const pageNum = Math.max(1, parseInt(page))
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * pageSize

    const where: any = {}
    if (region) where.region = region
    if (cooperativeId) where.cooperativeId = cooperativeId
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const context = await getUserContext(request)
    if (context) {
      if (context.role === 'FARMER') {
        where.id = context.farmerId ?? '__none__'
      } else if (context.role === 'COOP_ADMIN') {
        if (cooperativeId && context.cooperativeId && cooperativeId !== context.cooperativeId) {
          where.id = '__none__'
        } else {
          where.cooperativeId = context.cooperativeId ?? '__none__'
        }
      } else if (context.role === 'INSTITUTION_ADMIN' || context.role === 'MFI_AGENT') {
        where.cooperative = { institutionId: context.institutionId ?? '__none__' }
      }
    }

    const [rows, total] = await Promise.all([
      prisma.farmer.findMany({ where, skip, take: pageSize, orderBy: { onboardedAt: 'desc' } }),
      prisma.farmer.count({ where }),
    ])

    const data = rows.map((farmer) => {
      const allowSensitive = shouldShowSensitive(context, farmer.id)
      return sanitizeFarmerForRead(farmer, allowSensitive)
    })

    return { data, total, page: pageNum, pageSize }
  })

  // GET /v1/farmers/:id
  fastify.get('/:id', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const context = await getUserContext(request)
    if (!context) {
      const farmer = await prisma.farmer.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          country: true,
          region: true,
          province: true,
          commune: true,
          village: true,
          lat: true,
          lng: true,
          surface: true,
          photoUrl: true,
          kycStatus: true,
          onboardedAt: true,
          cooperative: {
            select: {
              id: true,
              name: true,
              institutionId: true,
              region: true,
              filiere: true,
            },
          },
        },
      })

      if (!farmer) return reply.status(404).send({ error: 'Farmer not found' })
      return minimalPublicFarmerProfile(farmer)
    }

    const canAccess = await canAccessFarmer(context, id)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const farmer = await prisma.farmer.findUnique({
      where: { id },
      include: {
        parcelles: true,
        creditScore: true,
        loans: true,
        alerts: { orderBy: { createdAt: 'desc' }, take: 5 },
        cooperative: {
          select: {
            id: true,
            name: true,
            institutionId: true,
            region: true,
            filiere: true,
          },
        },
      },
    })

    if (!farmer) return reply.status(404).send({ error: 'Farmer not found' })

    const allowSensitive = shouldShowSensitive(context, farmer.id)
    return sanitizeFarmerForRead(farmer, allowSensitive)
  })

  // GET /v1/farmers/:id/dossier-comite
  fastify.get('/:id/dossier-comite', { preHandler: verifyToken }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessFarmer(context, id)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const bundle = await loadDossierBundle(id, context.institutionId, {
      useCooperativeInstitutionFallback: true,
    })
    return buildDossierResponse(bundle, context)
  })

  // POST /v1/farmers
  fastify.post('/', { preHandler: verifyToken }, async (request, reply) => {
    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    if (!['SUPERADMIN', 'COOP_ADMIN', 'INSTITUTION_ADMIN', 'MFI_AGENT'].includes(context.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const body = request.body as {
      firstName: string
      lastName: string
      phone: string
      country?: string
      cin?: string
      region: string
      province?: string
      commune?: string
      village: string
      lat: number
      lng: number
      surface: number
      cooperativeId?: string | null
      userId: string
      cndpConsent?: boolean
      cndpConsentAt?: string
      cndpConsentVersion?: string
      dateNaissance?: string
      sexe?: string
    }

    const country = normalizeCountry(body.country)
    const validation = validateMoroccoInputs({
      country,
      phone: body.phone,
      cin: body.cin,
      cndpConsent: body.cndpConsent,
    })
    if (!validation.ok) return reply.status(400).send({ error: validation.error })

    const cndpConsentAt = body.cndpConsent === true
      ? parseDateMaybe(body.cndpConsentAt) ?? new Date()
      : null
    if (body.cndpConsentAt !== undefined && !parseDateMaybe(body.cndpConsentAt)) {
      return reply.status(400).send({ error: 'Invalid cndpConsentAt' })
    }

    let cooperativeId = body.cooperativeId ?? null
    if (context.role === 'COOP_ADMIN') {
      if (!context.cooperativeId) return reply.status(403).send({ error: 'Forbidden' })
      if (cooperativeId && cooperativeId !== context.cooperativeId) {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      cooperativeId = context.cooperativeId
    }

    const dateNaissance = body.dateNaissance === undefined ? undefined : parseDateMaybe(body.dateNaissance)
    if (body.dateNaissance !== undefined && !dateNaissance) {
      return reply.status(400).send({ error: 'Invalid dateNaissance' })
    }

    const farmer = await prisma.farmer.create({
      data: {
        userId: body.userId,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        country,
        cin: body.cin ?? null,
        region: body.region,
        province: body.province ?? null,
        commune: body.commune ?? null,
        village: body.village,
        lat: body.lat,
        lng: body.lng,
        surface: body.surface,
        cooperativeId,
        cndpConsent: body.cndpConsent === true,
        cndpConsentAt,
        cndpConsentVersion: body.cndpConsentVersion ?? null,
        dateNaissance,
        sexe: body.sexe ?? null,
        moroccoPhoneNormalized: country === MOROCCO_COUNTRY ? normalizeMoroccoPhone(body.phone) : null,
      },
    })

    const allowSensitive = shouldShowSensitive(context, farmer.id)
    return reply.status(201).send(sanitizeFarmerForRead(farmer, allowSensitive))
  })

  // PATCH /v1/farmers/:id
  fastify.patch('/:id', { preHandler: verifyToken }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = asObject(request.body)
    if (!body || !hasDefinedValue(body)) {
      return reply.status(400).send({ error: 'Invalid payload' })
    }

    if (hasForbiddenKey(body, ['id', 'userId', 'role', 'passwordHash', 'createdAt', 'updatedAt'])) {
      return reply.status(400).send({ error: 'Invalid payload' })
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessFarmer(context, id)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const current = await prisma.farmer.findUnique({
      where: { id },
      select: {
        country: true,
        cndpConsent: true,
        cndpConsentAt: true,
      },
    })
    if (!current) return reply.status(404).send({ error: 'Farmer not found' })

    const nextCountry = normalizeCountry(body.country, current.country ?? 'CI')
    const nextConsent = body.cndpConsent === undefined ? current.cndpConsent : body.cndpConsent === true

    const validation = validateMoroccoInputs({
      country: nextCountry,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      cin: typeof body.cin === 'string' ? body.cin : undefined,
      cndpConsent: nextConsent,
    })
    if (!validation.ok) return reply.status(400).send({ error: validation.error })

    let cndpConsentAt: Date | null | undefined
    if (body.cndpConsentAt !== undefined) {
      cndpConsentAt = parseDateMaybe(body.cndpConsentAt)
      if (!cndpConsentAt) return reply.status(400).send({ error: 'Invalid cndpConsentAt' })
    } else if (nextCountry === MOROCCO_COUNTRY && nextConsent === true && !current.cndpConsentAt) {
      cndpConsentAt = new Date()
    } else if (nextConsent === false) {
      cndpConsentAt = null
    }

    let dateNaissance: Date | null | undefined
    if (body.dateNaissance !== undefined) {
      if (body.dateNaissance === null || body.dateNaissance === '') {
        dateNaissance = null
      } else {
        dateNaissance = parseDateMaybe(body.dateNaissance)
        if (!dateNaissance) return reply.status(400).send({ error: 'Invalid dateNaissance' })
      }
    }

    const updated = await prisma.farmer.update({
      where: { id },
      data: {
        ...(body.firstName !== undefined && { firstName: body.firstName }),
        ...(body.lastName !== undefined && { lastName: body.lastName }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.country !== undefined && { country: nextCountry }),
        ...(body.cin !== undefined && { cin: body.cin }),
        ...(body.region !== undefined && { region: body.region }),
        ...(body.province !== undefined && { province: body.province }),
        ...(body.commune !== undefined && { commune: body.commune }),
        ...(body.village !== undefined && { village: body.village }),
        ...(body.surface !== undefined && { surface: Number(body.surface) }),
        ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl }),
        ...(body.cniUrl !== undefined && { cniUrl: body.cniUrl }),
        ...(body.attestationUrl !== undefined && { attestationUrl: body.attestationUrl }),
        ...(body.cooperativeId !== undefined && { cooperativeId: body.cooperativeId }),
        ...(body.lat !== undefined && { lat: Number(body.lat) }),
        ...(body.lng !== undefined && { lng: Number(body.lng) }),
        ...(body.experienceAnnees !== undefined && { experienceAnnees: body.experienceAnnees }),
        ...(body.revenusAnnexes !== undefined && { revenusAnnexes: body.revenusAnnexes }),
        ...(body.historicCredit !== undefined && { historicCredit: body.historicCredit }),
        ...(body.cndpConsent !== undefined && { cndpConsent: body.cndpConsent === true }),
        ...(cndpConsentAt !== undefined && { cndpConsentAt }),
        ...(body.cndpConsentVersion !== undefined && { cndpConsentVersion: body.cndpConsentVersion }),
        ...(dateNaissance !== undefined && { dateNaissance }),
        ...(body.sexe !== undefined && { sexe: body.sexe }),
        ...(body.phone !== undefined && nextCountry === MOROCCO_COUNTRY && {
          moroccoPhoneNormalized: normalizeMoroccoPhone(body.phone as string),
        }),
      }
    })

    const allowSensitive = shouldShowSensitive(context, updated.id)
    return sanitizeFarmerForRead(updated, allowSensitive)
  })
}
