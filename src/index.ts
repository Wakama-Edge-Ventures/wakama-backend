import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import path from 'path'
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
import { collectWeatherForAllParcelles, collectWeatherForAllCoops } from './jobs/weatherCollector.js'
import { generateAlertsForAllFarmers, generateAlertsForCoops } from './jobs/alertsGenerator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = Fastify({ logger: true })

async function bootstrap() {
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET as string,
  })

  await app.register(multipart)

  await app.register(staticFiles, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  })

  initUploadDirs()

  app.get('/health', async () => {
    return { status: 'ok', version: '1.0.0' }
  })

  app.register(farmersRoutes)
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

  const port = Number(process.env.PORT) || 4000

  await app.listen({ port, host: '0.0.0.0' })
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

bootstrap().catch((err) => {
  app.log.error(err)
  process.exit(1)
})

process.on('SIGINT', async () => {
  await app.close()
  process.exit(0)
})
