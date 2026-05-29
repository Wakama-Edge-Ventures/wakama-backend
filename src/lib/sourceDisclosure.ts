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
  "Wakama structure le risque technique et les preuves d'integrite. L'assureur reste seul decisionnaire pour l'eligibilite, la tarification commerciale, l'emission de police et l'indemnisation. Les donnees peuvent etre LIVE, SEED_DEMO, EXCEL_IMPORT ou MANUAL_ESTIMATE. L'ancrage blockchain/IPFS est un horodatage d'integrite et non une decision legale ou reglementaire."

const BASE_DISCLAIMER_EN =
  'Wakama provides technical risk structuring and integrity evidence. The insurer remains the sole decision-maker for eligibility, commercial pricing, policy issuance, and indemnification. Data may be LIVE, SEED_DEMO, EXCEL_IMPORT, or MANUAL_ESTIMATE. Blockchain/IPFS anchoring is integrity timestamping, not a legal or regulatory decision.'

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
