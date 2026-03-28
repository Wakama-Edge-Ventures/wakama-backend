import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { calculateWakamaScore } from '../lib/wakamaScore.js'

export default async function scoresRoutes(fastify: FastifyInstance) {

  // GET /v1/scores/:farmerId — calculate and return Wakama Score
  // Optional query param: ?institutionId=xxx to apply custom institution weights
  fastify.get('/v1/scores/:farmerId', async (request, reply) => {
    const { farmerId } = request.params as { farmerId: string }
    const { institutionId } = request.query as { institutionId?: string }

    try {
      const result = await calculateWakamaScore(farmerId)

      let finalScore = result.score
      let weights = { c1: 30, c2: 25, c3: 25, c4: 20 }
      let products: Array<{ name: string; minScore: number; eligible: boolean; [key: string]: any }> | null = null

      if (institutionId) {
        const config = await prisma.institutionScoringConfig.findUnique({
          where: { institutionId }
        })

        if (config) {
          weights = {
            c1: config.weightC1,
            c2: config.weightC2,
            c3: config.weightC3,
            c4: config.weightC4,
          }

          // Recompute final score with institution-specific weights
          const scoreWeighted = (
            result.scoreC1 * (config.weightC1 / 100) +
            result.scoreC2 * (config.weightC2 / 100) +
            result.scoreC3 * (config.weightC3 / 100) +
            result.scoreC4 * (config.weightC4 / 100)
          )
          finalScore = Math.round(scoreWeighted * 10)

          // Process custom products from config
          if (config.products) {
            const rawProducts = config.products as any[]
            if (Array.isArray(rawProducts)) {
              products = rawProducts.map((p: any) => ({
                ...p,
                eligible: finalScore >= (p.minScore ?? 0),
              }))
            }
          }
        }
      }

      const status = finalScore >= 700 ? 'EXCELLENT'
        : finalScore >= 500 ? 'BON'
        : finalScore >= 300 ? 'MOYEN'
        : 'FAIBLE'

      const riskLevel = finalScore >= 600 ? 'LOW'
        : finalScore >= 400 ? 'MEDIUM'
        : 'HIGH'

      // Save score to DB (always persist the base score without custom weights)
      await prisma.creditScore.upsert({
        where: { farmerId },
        update: {
          score: result.score,
          scoreMax: 1000,
          status: result.score >= 700 ? 'EXCELLENT'
            : result.score >= 500 ? 'BON'
            : result.score >= 300 ? 'MOYEN'
            : 'FAIBLE',
          riskLevel: result.score >= 600 ? 'LOW'
            : result.score >= 400 ? 'MEDIUM'
            : 'HIGH',
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
          status: result.score >= 700 ? 'EXCELLENT'
            : result.score >= 500 ? 'BON'
            : result.score >= 300 ? 'MOYEN'
            : 'FAIBLE',
          riskLevel: result.score >= 600 ? 'LOW'
            : result.score >= 400 ? 'MEDIUM'
            : 'HIGH',
          historiquePayments: result.scoreC2 / 100,
          utilisationCredit: result.scoreC1 / 100,
          diversificationCultures: Math.min(result.details.c1.culturesPrincipales.length / 5, 1),
          regulariteDeclarations: Math.min(result.details.c2.nbActivites / 10, 1),
        },
      })

      // Build response — institution-aware when institutionId provided
      if (institutionId) {
        return {
          ...result,
          score: finalScore,
          weights,
          institutionId,
          ...(products !== null && { products }),
        }
      }

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
