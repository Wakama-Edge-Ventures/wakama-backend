import { FastifyInstance } from 'fastify'
import { pipeline } from 'stream/promises'
import fs from 'fs'
import path from 'path'
import prisma from '../lib/prisma.js'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function initUploadDirs() {
  ensureDir(path.join(UPLOADS_DIR, 'farmers'))
  ensureDir(path.join(UPLOADS_DIR, 'cooperatives'))
}

export default async function uploadRoutes(fastify: FastifyInstance) {
  // POST /v1/upload/farmer/:farmerId/photo
  fastify.post('/v1/upload/farmer/:farmerId/photo', async (request, reply) => {
    const { farmerId } = request.params as { farmerId: string }
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const ext = path.extname(data.filename) || '.jpg'
    const dir = path.join(UPLOADS_DIR, 'farmers', farmerId)
    ensureDir(dir)
    const filePath = path.join(dir, `photo${ext}`)
    await pipeline(data.file, fs.createWriteStream(filePath))

    const url = `/uploads/farmers/${farmerId}/photo${ext}`
    await prisma.farmer.update({ where: { id: farmerId }, data: { blockchainId: url } })
    return { url }
  })

  // POST /v1/upload/farmer/:farmerId/document
  fastify.post('/v1/upload/farmer/:farmerId/document', async (request, reply) => {
    const { farmerId } = request.params as { farmerId: string }
    const { type = 'cni' } = request.query as { type?: string }
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const ext = path.extname(data.filename) || '.pdf'
    const dir = path.join(UPLOADS_DIR, 'farmers', farmerId)
    ensureDir(dir)
    const filePath = path.join(dir, `${type}${ext}`)
    await pipeline(data.file, fs.createWriteStream(filePath))

    const url = `/uploads/farmers/${farmerId}/${type}${ext}`
    return { url }
  })

  // POST /v1/upload/cooperative/:coopId/logo
  fastify.post('/v1/upload/cooperative/:coopId/logo', async (request, reply) => {
    const { coopId } = request.params as { coopId: string }
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const ext = path.extname(data.filename) || '.png'
    const dir = path.join(UPLOADS_DIR, 'cooperatives', coopId)
    ensureDir(dir)
    const filePath = path.join(dir, `logo${ext}`)
    await pipeline(data.file, fs.createWriteStream(filePath))

    const url = `/uploads/cooperatives/${coopId}/logo${ext}`
    return { url }
  })
}
