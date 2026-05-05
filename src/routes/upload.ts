import { FastifyInstance } from 'fastify'
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'
import fs from 'fs'
import path from 'path'
import prisma from '../lib/prisma.js'
import { getUserContext, verifyToken } from '../middleware/auth.js'
import { canAccessCooperative, canAccessFarmer } from '../middleware/ownership.js'
import { getUploadMaxBytes } from '../lib/security.js'
import { createUploadRateLimit } from '../middleware/rateLimit.js'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9_-]+$/
const ALLOWED_EXTENSIONS: readonly string[] = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
const ALLOWED_EXTENSIONS_SET = new Set(ALLOWED_EXTENSIONS)
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function initUploadDirs() {
  ensureDir(path.join(UPLOADS_DIR, 'farmers'))
  ensureDir(path.join(UPLOADS_DIR, 'cooperatives'))
}

export default async function uploadRoutes(fastify: FastifyInstance) {
  const uploadRateLimit = createUploadRateLimit()
  const uploadMaxBytes = getUploadMaxBytes()

  // POST /v1/upload/farmer/:farmerId/photo
  fastify.post(
    '/v1/upload/farmer/:farmerId/photo',
    { preHandler: [uploadRateLimit, verifyToken] },
    async (request, reply) => {
    const { farmerId } = request.params as { farmerId: string }
    if (!isSafePathSegment(farmerId)) return reply.status(400).send({ error: 'Invalid farmerId' })

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessFarmer(context, farmerId)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const ext = getSafeExtension(data.filename)
    if (!ext) return reply.status(400).send({ error: 'Invalid file type' })
    if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizeMimeType(data.mimetype))) {
      return reply.status(400).send({ error: 'Invalid file type' })
    }

    const dir = path.join(UPLOADS_DIR, 'farmers', farmerId)
    ensureDir(dir)
    const filePath = path.join(dir, `photo${ext}`)
    const saved = await saveUploadFile(data.file, filePath, uploadMaxBytes)
    if (saved === 'too_large') return reply.status(400).send({ error: 'File too large' })
    if (saved === 'empty') return reply.status(400).send({ error: 'Empty file' })

    const url = `/uploads/farmers/${farmerId}/photo${ext}`
    await prisma.farmer.update({ where: { id: farmerId }, data: { photoUrl: url } })
    return { url }
    }
  )

  // POST /v1/upload/farmer/:farmerId/document
  fastify.post(
    '/v1/upload/farmer/:farmerId/document',
    { preHandler: [uploadRateLimit, verifyToken] },
    async (request, reply) => {
    const { farmerId } = request.params as { farmerId: string }
    const { type = 'cni' } = request.query as { type?: string }
    if (!isSafePathSegment(farmerId)) return reply.status(400).send({ error: 'Invalid farmerId' })
    if (!isAllowedFarmerDocumentType(type)) {
      return reply.status(400).send({ error: 'Invalid document type' })
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessFarmer(context, farmerId)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const ext = getSafeExtension(data.filename)
    if (!ext) return reply.status(400).send({ error: 'Invalid file type' })
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(normalizeMimeType(data.mimetype))) {
      return reply.status(400).send({ error: 'Invalid file type' })
    }

    const dir = path.join(UPLOADS_DIR, 'farmers', farmerId)
    ensureDir(dir)

    // Remove any previous file for this document type (different extension may exist)
    for (const oldExt of ALLOWED_EXTENSIONS) {
      const oldPath = path.join(dir, `${type}${oldExt}`)
      if (fs.existsSync(oldPath)) fs.rmSync(oldPath, { force: true })
    }

    const filePath = path.join(dir, `${type}${ext}`)
    const saved = await saveUploadFile(data.file, filePath, uploadMaxBytes)
    if (saved === 'too_large') return reply.status(400).send({ error: 'File too large' })
    if (saved === 'empty') return reply.status(400).send({ error: 'Empty file' })

    const stat = fs.statSync(filePath)
    const magicBuf = stat.size >= 4 ? readMagicBytes(filePath) : null

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[upload] POST /farmer/${farmerId}/document?type=${type}`)
      console.log(`  original filename : ${data.filename}`)
      console.log(`  saved as         : ${filePath}`)
      console.log(`  mimetype received: ${data.mimetype}`)
      console.log(`  file size        : ${stat.size} bytes`)
      if (magicBuf) {
        console.log(`  magic bytes      : ${magicBuf.toString('hex')}  (ascii: ${magicBuf.toString('ascii').replace(/\r?\n/g, '\\n')})`)
      }
    }

    // Reject files claiming to be PDF whose content is not a valid PDF
    if (ext === '.pdf' || normalizeMimeType(data.mimetype) === 'application/pdf') {
      if (!magicBuf || !magicBuf.toString('ascii').startsWith('%PDF')) {
        fs.rmSync(filePath, { force: true })
        return reply.status(400).send({ error: 'Fichier PDF invalide : contenu non reconnu' })
      }
    }

    const url = `/uploads/farmers/${farmerId}/${type}${ext}`
    return { url }
    }
  )

  // GET /v1/upload/farmer/:farmerId/document
  // Protected download endpoint for sensitive KYC documents (CNI, attestation).
  // Use this instead of the raw /uploads/* static URL which is now blocked for documents.
  fastify.get(
    '/v1/upload/farmer/:farmerId/document',
    { preHandler: [verifyToken] },
    async (request, reply) => {
    const { farmerId } = request.params as { farmerId: string }
    const { type = 'cni' } = request.query as { type?: string }

    if (!isSafePathSegment(farmerId)) return reply.status(400).send({ error: 'Invalid farmerId' })
    if (!isAllowedFarmerDocumentType(type)) {
      return reply.status(400).send({ error: 'Invalid document type' })
    }

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessFarmer(context, farmerId)
    if (canAccess === null) return reply.status(404).send({ error: 'Farmer not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const dir = path.join(UPLOADS_DIR, 'farmers', farmerId)
    const MIME_BY_EXT: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    }

    let filePath: string | null = null
    let mimeType = 'application/octet-stream'

    for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.pdf']) {
      const candidate = path.join(dir, `${type}${ext}`)
      if (fs.existsSync(candidate)) {
        filePath = candidate
        mimeType = MIME_BY_EXT[ext] ?? 'application/octet-stream'
        break
      }
    }

    if (!filePath) return reply.status(404).send({ error: 'Document not found' })

    const ext = path.extname(filePath)
    reply.header('Content-Type', mimeType)
    reply.header('Content-Disposition', `inline; filename="${type}${ext}"`)
    return reply.send(fs.createReadStream(filePath))
    }
  )

  // POST /v1/upload/cooperative/:coopId/logo
  fastify.post(
    '/v1/upload/cooperative/:coopId/logo',
    { preHandler: [uploadRateLimit, verifyToken] },
    async (request, reply) => {
    const { coopId } = request.params as { coopId: string }
    if (!isSafePathSegment(coopId)) return reply.status(400).send({ error: 'Invalid coopId' })

    const context = await getUserContext(request)
    if (!context) return reply.status(401).send({ error: 'Unauthorized' })

    const canAccess = await canAccessCooperative(context, coopId)
    if (canAccess === null) return reply.status(404).send({ error: 'Cooperative not found' })
    if (!canAccess) return reply.status(403).send({ error: 'Forbidden' })

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const ext = getSafeExtension(data.filename)
    if (!ext) return reply.status(400).send({ error: 'Invalid file type' })
    if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizeMimeType(data.mimetype))) {
      return reply.status(400).send({ error: 'Invalid file type' })
    }

    const dir = path.join(UPLOADS_DIR, 'cooperatives', coopId)
    ensureDir(dir)
    const filePath = path.join(dir, `logo${ext}`)
    const saved = await saveUploadFile(data.file, filePath, uploadMaxBytes)
    if (saved === 'too_large') return reply.status(400).send({ error: 'File too large' })
    if (saved === 'empty') return reply.status(400).send({ error: 'Empty file' })

    const url = `/uploads/cooperatives/${coopId}/logo${ext}`
    return { url }
    }
  )
}

function readMagicBytes(filePath: string): Buffer {
  const fd = fs.openSync(filePath, 'r')
  const buf = Buffer.alloc(4)
  fs.readSync(fd, buf, 0, 4, 0)
  fs.closeSync(fd)
  return buf
}

function normalizeMimeType(value?: string): string {
  return (value ?? '').toLowerCase()
}

function getSafeExtension(filename: string): string | null {
  const extension = path.extname(path.basename(filename)).toLowerCase()
  return ALLOWED_EXTENSIONS_SET.has(extension) ? extension : null
}

function isAllowedFarmerDocumentType(value: string): boolean {
  return value === 'cni' || value === 'attestation'
}

function isSafePathSegment(value: string): boolean {
  return SAFE_PATH_SEGMENT.test(value)
}

async function saveUploadFile(
  input: NodeJS.ReadableStream,
  filePath: string,
  maxBytes: number
): Promise<'ok' | 'too_large' | 'empty'> {
  let totalBytes = 0

  try {
    await pipeline(
      input,
      new Transform({
        transform(chunk, _encoding, callback) {
          totalBytes += Buffer.byteLength(chunk)
          if (totalBytes > maxBytes) {
            callback(new Error('FILE_TOO_LARGE'))
            return
          }

          callback(null, chunk)
        },
      }),
      fs.createWriteStream(filePath)
    )
  } catch (error) {
    fs.rmSync(filePath, { force: true })
    if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
      return 'too_large'
    }

    throw error
  }

  if (totalBytes === 0) {
    fs.rmSync(filePath, { force: true })
    return 'empty'
  }

  return 'ok'
}
