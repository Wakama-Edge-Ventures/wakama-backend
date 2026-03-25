import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { calculateWakamaScore } from '../lib/wakamaScore.js'

export default async function scoresRoutes(fastify: FastifyInstance) {

  // GET /v1/scores/:farmerId — calculate and return Wakama Score
  fastify.get('/v1/scores/:farmerId', async (request, reply) => {
    const { farmerId } = request.params as { farmerId: string }

    try {
      const result = await calculateWakamaScore(farmerId)

      const status = result.score >= 700 ? 'EXCELLENT'
        : result.score >= 500 ? 'BON'
        : result.score >= 300 ? 'MOYEN'
        : 'FAIBLE'

      const riskLevel = result.score >= 600 ? 'LOW'
        : result.score >= 400 ? 'MEDIUM'
        : 'HIGH'

      // Save score to DB
      await prisma.creditScore.upsert({
        where: { farmerId },
        update: {
          score: result.score,
          scoreMax: 1000,
          status,
          riskLevel,
          historiquePayments: result.scoreC2 / 100,
          utilisationCredit: result.scoreC1 / 100,
          diversificationCultures: Math.min(result.details.c1.culturesPrincipales.length / 5, 1),
          regulariteDeclarations: Math.min(result.details.c2.nbActivites / 10, 1),
          generatedAt: new Date(),
        },
        create: {
          farmerId,
          score: result.score,
          scoreMax: 1000,
          status,
          riskLevel,
          historiquePayments: result.scoreC2 / 100,
          utilisationCredit: result.scoreC1 / 100,
          diversificationCultures: Math.min(result.details.c1.culturesPrincipales.length / 5, 1),
          regulariteDeclarations: Math.min(result.details.c2.nbActivites / 10, 1),
        },
      })

      return result
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Score calculation failed',
        message: err.message
      })
    }
  })

  // GET /v1/scores/coop/:coopId — portfolio score for B2B dashboard
  fastify.get('/v1/scores/coop/:coopId', async (request, reply) => {
    const { coopId } = request.params as { coopId: string }

    const farmers = await prisma.farmer.findMany({
      where: { cooperativeId: coopId },
      select: { id: true, firstName: true, lastName: true }
    })

    const scores = await Promise.all(
      farmers.map(async (f) => {
        try {
          const result = await calculateWakamaScore(f.id)
          return {
            farmerId: f.id,
            name: `${f.firstName} ${f.lastName}`,
            score: result.score,
            eligibilite: result.eligibilite,
            produitSuggere: result.produitSuggere,
            montantMaxSuggere: result.montantMaxSuggere
          }
        } catch {
          return { farmerId: f.id, name: `${f.firstName} ${f.lastName}`, score: 0 }
        }
      })
    )

    const avgScore = farmers.length > 0
      ? Math.round(scores.reduce((s, f) => s + f.score, 0) / scores.length)
      : 0
    const eligible = scores.filter(f => f.score >= 300).length

    return {
      coopId,
      totalFarmers: farmers.length,
      avgScore,
      eligible,
      eligibiliteRate: farmers.length > 0 ? Math.round((eligible / farmers.length) * 100) : 0,
      farmers: scores.sort((a, b) => b.score - a.score)
    }
  })
}
