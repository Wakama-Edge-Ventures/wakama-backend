import { buildSourceDisclosure, type SourceDisclosure } from '../sourceDisclosure.js'

export type TechnicalRiskTier = 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'UNINSURABLE'

export interface CalculateRaxInput {
  gravityScore: number
  frequencyScore: number
  detectionScore: number
  source?: string | null
  provider?: string | null
  confidence?: string | null
  explanationFactors?: string[]
}

export interface CalculateRaxResult {
  gravityScore: number
  frequencyScore: number
  detectionScore: number
  raxBrut: number
  wrs: number
  riskTier: TechnicalRiskTier
  technicalRiskTier: TechnicalRiskTier
  algorithmVersion: 'RAX_V1_MA_2026'
  explanationFactors: string[]
  warnings: string[]
  sourceDisclosure: SourceDisclosure
}

function sanitizeScore(value: number, label: string, warnings: string[]): number {
  if (!Number.isFinite(value)) {
    warnings.push(`${label} was invalid and defaulted to 3`)
    return 3
  }

  if (value < 1) {
    warnings.push(`${label} was below 1 and was clamped to 1`)
    return 1
  }

  if (value > 5) {
    warnings.push(`${label} was above 5 and was clamped to 5`)
    return 5
  }

  return Number(value.toFixed(3))
}

export function classifyWrs(wrs: number): TechnicalRiskTier {
  if (wrs <= 20) return 'LOW_RISK'
  if (wrs <= 50) return 'MEDIUM_RISK'
  if (wrs <= 75) return 'HIGH_RISK'
  return 'UNINSURABLE'
}

export function calculateRax(input: CalculateRaxInput): CalculateRaxResult {
  const warnings: string[] = []

  const gravityScore = sanitizeScore(input.gravityScore, 'gravityScore', warnings)
  const frequencyScore = sanitizeScore(input.frequencyScore, 'frequencyScore', warnings)
  const detectionScore = sanitizeScore(input.detectionScore, 'detectionScore', warnings)

  const raxBrut = Number((gravityScore * frequencyScore * detectionScore).toFixed(3))
  const wrs = Number(((raxBrut / 25) * 100).toFixed(3))
  const riskTier = classifyWrs(wrs)

  const explanationFactors = explainRax(input, {
    gravityScore,
    frequencyScore,
    detectionScore,
    raxBrut,
    wrs,
    riskTier,
  })

  return {
    gravityScore,
    frequencyScore,
    detectionScore,
    raxBrut,
    wrs,
    riskTier,
    technicalRiskTier: riskTier,
    algorithmVersion: 'RAX_V1_MA_2026',
    explanationFactors,
    warnings,
    sourceDisclosure: buildSourceDisclosure({
      source: input.source ?? 'MANUAL_ESTIMATE',
      provider: input.provider ?? 'RAX_ENGINE',
      confidence: input.confidence ?? 'MEDIUM',
    }),
  }
}

export function explainRax(
  input: CalculateRaxInput,
  result: Pick<CalculateRaxResult, 'gravityScore' | 'frequencyScore' | 'detectionScore' | 'raxBrut' | 'wrs' | 'riskTier'>
): string[] {
  const factors = input.explanationFactors ? [...input.explanationFactors] : []

  factors.push(`Formula applied: RAX_BRUT = G x F x D = ${result.gravityScore} x ${result.frequencyScore} x ${result.detectionScore} = ${result.raxBrut}`)
  factors.push(`WRS computed as (RAX_BRUT / 25) x 100 = ${result.wrs}`)
  factors.push(`Technical risk tier classified as ${result.riskTier}`)

  return factors
}
