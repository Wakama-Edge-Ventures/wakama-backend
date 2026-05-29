import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import path from 'path'
import net from 'net'
import { fileURLToPath } from 'url'
import farmersRoutes from './routes/farmers.js'
import cooperativesRoutes from './routes/cooperatives.js'
import scoresRoutes from './routes/scores.js'
import alertsRoutes from './routes/alerts.js'
import uploadRoutes, { initUploadDirs } from './routes/upload.js'
import authRoutes from './routes/auth.js'
import parcellesRoutes from './routes/parcelles.js'
import ndviRoutes from './routes/ndvi.js'
import weatherRoutes from './routes/weather.js'
import iotRoutes from './routes/iot.js'
import activitiesRoutes from './routes/activities.js'
import messagesRoutes from './routes/messages.js'
import creditRequestsRoutes from './routes/creditRequests.js'
import iotKitRequestsRoutes from './routes/iotKitRequests.js'
import institutionsRoutes from './routes/institutions.js'
import moroccoRoutes from './routes/morocco.js'
import insuranceReferenceRoutes from './routes/insuranceReferences.js'
import insuranceRoutes from './routes/insurance.js'
import { collectWeatherForAllParcelles, collectWeatherForAllCoops } from './jobs/weatherCollector.js'
import { generateAlertsForAllFarmers, generateAlertsForCoops } from './jobs/alertsGenerator.js'
import { getAllowedCorsOrigins } from './lib/security.js'
import { createGlobalRateLimit } from './middleware/rateLimit.js'
import { getUserContext } from './middleware/auth.js'
import { canAccessFarmer } from './middleware/ownership.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = Fastify({ logger: true })

process.on('uncaughtException', console.error)
process.on('unhandledRejection', console.error)

async function bootstrap() {
  console.log('STEP 1')
  const allowedOrigins = new Set(getAllowedCorsOrigins())

  console.log('STEP 2')
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      callback(null, allowedOrigins.has(origin))
    },
    preflight: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
  })
  console.log('CORS registered')

  await app.register(jwt, {
    secret: process.env.JWT_SECRET as string,
  })

  // Protect sensitive KYC documents from public static serving.
  // Photos (/uploads/farmers/*/photo.*) and cooperative logos remain public.
  const SENSITIVE_FARMER_DOC = /^\/uploads\/farmers\/([a-zA-Z0-9_-]+)\/(cni|attestation)\.[a-z]+$/
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url.split('?')[0]
    const match = SENSITIVE_FARMER_DOC.exec(url)
    if (!match) return

    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
      return
    }

    const farmerId = match[1]
    const context = await getUserContext(request)
    if (!context) {
      reply.status(401).send({ error: 'Unauthorized' })
      return
    }

    const canAccess = await canAccessFarmer(context, farmerId)
    if (canAccess === null) {
      reply.status(404).send({ error: 'Farmer not found' })
      return
    }
    if (!canAccess) {
      reply.status(403).send({ error: 'Forbidden' })
      return
    }
  })

  console.log('STEP 3')
  await app.register(multipart)

  app.addHook('preHandler', createGlobalRateLimit())

  console.log('STEP 4')
  await app.register(staticFiles, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  })

  initUploadDirs()

  console.log('STEP 5')
  app.get('/health', async () => {
    return { status: 'ok', version: '1.0.0' }
  })

  console.log('STEP 6')
  app.register(farmersRoutes, { prefix: '/v1/farmers' })
  console.log('farmers routes loaded')
  app.register(cooperativesRoutes)
  app.register(scoresRoutes)
  app.register(alertsRoutes)
  app.register(uploadRoutes)
  app.register(authRoutes)
  app.register(parcellesRoutes)
  app.register(ndviRoutes)
  app.register(weatherRoutes)
  app.register(iotRoutes)
  app.register(activitiesRoutes)
  app.register(messagesRoutes)
  app.register(creditRequestsRoutes)
  app.register(iotKitRequestsRoutes)
  app.register(institutionsRoutes)
  app.register(moroccoRoutes)
  app.register(insuranceReferenceRoutes)
  app.register(insuranceRoutes, { prefix: '/v1/insurance' })

  const preferredPort = Number(process.env.PORT) || 4000
  const port = await listenWithFallback(preferredPort)

  console.log('Route tree:\n' + app.printRoutes())
  console.log(`Server running on port ${port}`)

  // Run once on startup after 30 seconds
  setTimeout(async () => {
    await collectWeatherForAllParcelles()
    await collectWeatherForAllCoops()
  }, 30 * 1000)

  // Run every hour
  setInterval(async () => {
    await collectWeatherForAllParcelles()
    await collectWeatherForAllCoops()
  }, 60 * 60 * 1000)

  // Run alerts generation once on startup after 60 seconds
  setTimeout(async () => {
    await generateAlertsForAllFarmers()
    await generateAlertsForCoops()
  }, 60 * 1000)

  // Run alerts generation every 6 hours
  setInterval(async () => {
    await generateAlertsForAllFarmers()
    await generateAlertsForCoops()
  }, 6 * 60 * 60 * 1000)
}

async function listenWithFallback(preferredPort: number) {
  let targetPort = preferredPort
  const portAvailable = await isPortAvailable(preferredPort)
  if (!portAvailable) {
    targetPort = preferredPort + 1
    console.warn(`Port ${preferredPort} already in use, switching to ${targetPort}`)
  }

  await app.listen({ port: targetPort, host: '0.0.0.0' })
  return targetPort
}

async function isPortAvailable(port: number) {
  return await new Promise<boolean>((resolve) => {
    const server = net.createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close(() => resolve(true))
    })

    server.listen(port, '0.0.0.0')
  })
}

bootstrap().catch((err) => {
  app.log.error(err)
  process.exit(1)
})

process.on('SIGINT', async () => {
  await app.close()
  process.exit(0)
})
