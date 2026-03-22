import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { verifyToken } from '../middleware/auth.js'

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
    return { ...user, farmer }
  })
}
