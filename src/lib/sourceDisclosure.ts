export type SourceLabel = 'LIVE' | 'SEED_DEMO' | 'EXCEL_IMPORT' | 'MANUAL_ESTIMATE' | string

export interface SourceDisclosureInput {
  source?: string | null
  provider?: string | null
  confidence?: string | null
}

export interface SourceDisclosure {
  source: SourceLabel
  provider: string | null
  confidence: string | null
  disclaimerFr: string
  disclaimerEn: string
}

const BASE_DISCLAIMER_FR =
  "Wakama fournit des donnees techniques de reference. L'assureur reste seul decisionnaire pour l'eligibilite, la tarification commerciale, l'emission de police et l'indemnisation."

const BASE_DISCLAIMER_EN =
  'Wakama provides technical reference data. The insurer remains the sole decision-maker for eligibility, commercial pricing, policy issuance, and indemnification.'

export function buildSourceDisclosure(input?: SourceDisclosureInput): SourceDisclosure {
  const source = (input?.source?.trim() || 'SEED_DEMO') as SourceLabel
  return {
    source,
    provider: input?.provider?.trim() || null,
    confidence: input?.confidence?.trim() || null,
    disclaimerFr: BASE_DISCLAIMER_FR,
    disclaimerEn: BASE_DISCLAIMER_EN,
  }
}
