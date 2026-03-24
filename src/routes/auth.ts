import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { verifyToken } from '../middleware/auth.js'
import { sendOnboardingNotification } from '../lib/mailer.js'

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /v1/auth/register
  fastify.post('/v1/auth/register', async (request, reply) => {
    const body = request.body as {
      email: string
      password: string
      role: 'FARMER' | 'COOP_ADMIN' | 'MFI_AGENT' | 'SUPERADMIN'
      firstName: string
      lastName: string
      phone: string
      region?: string
      village?: string
      lat?: number
      lng?: number
      surface?: number
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) return reply.status(409).send({ error: 'Email already in use' })

    const passwordHash = await bcrypt.hash(body.password, 10)

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        role: body.role,
      },
    })

    let farmer = null
    if (body.role === 'FARMER') {
      farmer = await prisma.farmer.create({
        data: {
          userId: user.id,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          region: body.region ?? '',
          village: body.village ?? '',
          lat: body.lat ?? 0,
          lng: body.lng ?? 0,
          surface: body.surface ?? 0,
        },
      })
    }

    if (farmer) {
      sendOnboardingNotification(
        {
          id: farmer.id,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          region: body.region ?? '',
          village: body.village ?? '',
          surface: body.surface ?? 0,
          cooperativeId: null,
          kycStatus: 'PENDING',
          cniUrl: null,
          attestationUrl: null,
          onboardedAt: farmer.onboardedAt ?? new Date(),
        },
        { email: body.email }
      ).catch(err => console.error('[Mailer] Onboarding notification failed:', err))
    }

    const token = fastify.jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' }
    )

    return reply.status(201).send({
      token,
      user: { id: user.id, email: user.email, role: user.role },
      farmer: farmer ? { id: farmer.id } : null,
    })
  })

  // POST /v1/auth/login
  fastify.post('/v1/auth/login', async (request, reply) => {
    const body = request.body as { email: string; password: string }

    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

    const farmer = await prisma.farmer.findUnique({ where: { userId: user.id } })

    const token = fastify.jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' }
    )

    return {
      token,
      user: { id: user.id, email: user.email, role: user.role },
      farmerId: farmer?.id ?? null,
    }
  })

  // GET /v1/auth/me
  fastify.get('/v1/auth/me', { preHandler: verifyToken }, async (request, reply) => {
    const payload = request.user as { id: string }
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, createdAt: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const farmer = await prisma.farmer.findUnique({ where: { userId: user.id } })

    let coopId: string | null = null
    if (user.role === 'COOP_ADMIN') {
      const coop = await prisma.cooperative.findFirst({ where: { adminUserId: user.id } })
      coopId = coop?.id ?? null
    }

    return { ...user, farmer, coopId }
  })

  // POST /v1/auth/send-verification
  fastify.post('/v1/auth/send-verification', async (request, reply) => {
    const { email, firstName } = request.body as { email: string; firstName: string }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.status(409).send({ error: 'Email already in use' })

    const { generateCode, storeCode } = await import('../lib/verificationCodes.js')
    const { sendVerificationEmail } = await import('../lib/mailer.js')

    const code = generateCode()
    storeCode(email, code, firstName)
    await sendVerificationEmail(email, code, firstName)

    return { success: true, message: 'Code sent' }
  })

  // POST /v1/auth/verify-code
  fastify.post('/v1/auth/verify-code', async (request, reply) => {
    const { email, code } = request.body as { email: string; code: string }
    const { verifyCode } = await import('../lib/verificationCodes.js')

    const valid = verifyCode(email, code)
    if (!valid) return reply.status(400).send({ error: 'Code invalide ou expiré' })

    return { success: true, verified: true }
  })
}
