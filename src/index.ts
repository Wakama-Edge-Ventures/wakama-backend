import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'

const app = Fastify({ logger: true })

async function bootstrap() {
  await app.register(cors, { origin: true })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET as string,
  })

  app.get('/health', async () => {
    return { status: 'ok', version: '1.0.0' }
  })

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
