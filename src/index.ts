import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import farmersRoutes from './routes/farmers.js'
import cooperativesRoutes from './routes/cooperatives.js'
import scoresRoutes from './routes/scores.js'
import alertsRoutes from './routes/alerts.js'

const app = Fastify({ logger: true })

async function bootstrap() {
  await app.register(cors, { origin: true })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET as string,
  })

  app.get('/health', async () => {
    return { status: 'ok', version: '1.0.0' }
  })

  app.register(farmersRoutes)
  app.register(cooperativesRoutes)
  app.register(scoresRoutes)
  app.register(alertsRoutes)

  const port = Number(process.env.PORT) || 4000

  await app.listen({ port, host: '0.0.0.0' })
  console.log(`Server running on port ${port}`)
}

bootstrap().catch((err) => {
  app.log.error(err)
  process.exit(1)
})

process.on('SIGINT', async () => {
  await app.close()
  process.exit(0)
})
