import { hashJsonStable, stableJsonStringify } from './hash.js'

export interface BuildEvidenceBundleInput {
  entityType: string
  entityId: string
  payload: unknown
  source?: string
}

export interface BuiltEvidenceBundle {
  entityType: string
  entityId: string
  source: string
  payloadJson: string
  bundleHash: string
}

export function buildEvidenceBundle(input: BuildEvidenceBundleInput): BuiltEvidenceBundle {
  const payloadJson = stableJsonStringify(input.payload)
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    source: input.source ?? 'SEED_DEMO',
    payloadJson,
    bundleHash: hashJsonStable(JSON.parse(payloadJson)),
  }
}
