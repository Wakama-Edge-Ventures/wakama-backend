import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma.js'
import { calculateWakamaScore } from '../lib/wakamaScore.js'
import {
  buildScoreExplanation,
  loadDossierBundle,
} from '../lib/institutionalScoring.js'

export default async function scoresRoutes(fastify: FastifyInstance) {

  // GET /v1/scores/:farmerId — calculate and return Wakama Score
  // Optional query param: ?institutionId=xxx to apply custom institution weights
  fastify.get('/v1/scores/:farmerId', async (request, reply) => {
    const { farmerId } = request.params as { farmerId: string }
    const { institutionId } = request.query as { institutionId?: string }

    try {
      const bundle = await loadDossierBundle(farmerId, institutionId)
      const explanation = buildScoreExplanation(bundle)
      const result = bundle.scoreResult

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
          score: bundle.finalScore,
          scoreMax: bundle.scoreMax,
          status: bundle.scoreStatus,
          riskLevel: bundle.riskLevel,
          generatedAt: bundle.generatedAt,
          montantMin: result.montantMinSuggere,
          montantMax: result.montantMaxSuggere,
          modelVersion: explanation.modelVersion,
          confidenceLevel: explanation.confidenceLevel,
          readinessStatus: explanation.readinessStatus,
          committeeReadiness: {
            status: explanation.committeeReadiness.status,
            score: explanation.committeeReadiness.score,
            missingRequiredItems: explanation.committeeReadiness.missingRequiredItems,
            completedItems: explanation.committeeReadiness.completedItems,
          },
          positiveFactors: explanation.positiveFactors,
          riskFactors: explanation.riskFactors,
          missingData: explanation.missingData,
          nextBestActions: explanation.nextBestActions,
          scoreBreakdown: explanation.scoreBreakdown,
          weightsUsed: explanation.weightsUsed,
          weights: bundle.weights,
          institutionId,
          ...(bundle.products !== null && { products: bundle.products }),
        }
      }

      return {
        ...result,
        scoreMax: bundle.scoreMax,
        status: bundle.scoreStatus,
        riskLevel: bundle.riskLevel,
        generatedAt: bundle.generatedAt,
        montantMin: result.montantMinSuggere,
        montantMax: result.montantMaxSuggere,
        modelVersion: explanation.modelVersion,
        confidenceLevel: explanation.confidenceLevel,
        readinessStatus: explanation.readinessStatus,
        committeeReadiness: {
          status: explanation.committeeReadiness.status,
          score: explanation.committeeReadiness.score,
          missingRequiredItems: explanation.committeeReadiness.missingRequiredItems,
          completedItems: explanation.committeeReadiness.completedItems,
        },
        positiveFactors: explanation.positiveFactors,
        riskFactors: explanation.riskFactors,
        missingData: explanation.missingData,
        nextBestActions: explanation.nextBestActions,
        scoreBreakdown: explanation.scoreBreakdown,
        weightsUsed: explanation.weightsUsed,
      }
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
