import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { sendIotKitNotification } from '../lib/mailer.js'

export default async function iotKitRequestsRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/iot-kit-requests', async (request, reply) => {
    const body = request.body as {
      coopId?: string
      coopName: string
      superficie?: number
      culture?: string
      nbMembres?: number
      hasElectricite?: boolean
      hasConnexion?: boolean
      message?: string
    }

    const req = await prisma.iotKitRequest.create({
      data: {
        coopId: body.coopId,
        coopName: body.coopName,
        superficie: body.superficie,
        culture: body.culture,
        nbMembres: body.nbMembres,
        hasElectricite: body.hasElectricite ?? false,
        hasConnexion: body.hasConnexion ?? false,
        message: body.message,
      }
    })

    sendIotKitNotification({
      coopName: body.coopName,
      superficie: body.superficie,
      culture: body.culture,
      nbMembres: body.nbMembres,
      hasElectricite: body.hasElectricite ?? false,
      hasConnexion: body.hasConnexion ?? false,
      message: body.message,
    }).catch(err => console.error('[Mailer] IoT kit failed:', err))

    return reply.status(201).send(req)
  })
}
