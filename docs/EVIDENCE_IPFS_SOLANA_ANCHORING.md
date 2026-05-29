# Evidence, IPFS, and Solana Anchoring Foundation

## Scope

Phase 27A.2 adds a safe backend foundation for evidence integrity:
- Evidence files and evidence bundles
- Anchor queue records
- Blockchain anchor status tracking
- Pinata/IPFS and Solana service stubs

This is a foundation phase only. Live anchoring is not forced.

## Design Principles

- Backend-only secret handling.
- Never expose Pinata JWT or Solana private key to frontend.
- Anchoring is asynchronous and non-blocking.
- If config is missing or disabled, business flow must continue safely.

## Models Added

- `EvidenceFile`
- `EvidenceBundle`
- `BlockchainAnchor`
- `AnchorQueue`

## Service Stubs

- `src/lib/evidence/hash.ts`
- `src/lib/evidence/evidenceBundle.ts`
- `src/lib/evidence/pinata.ts`
- `src/lib/evidence/solana.ts`
- `src/lib/evidence/anchorQueue.ts`

## Environment Variables

Add in backend environment (not frontend):
- `PINATA_JWT`
- `PINATA_GATEWAY_URL`
- `IPFS_GATEWAY_URL`
- `SOLANA_WALLET_PRIVATE_KEY`
- `SOLANA_CLUSTER`
- `SOLANA_RPC_URL`
- `ANCHORING_ENABLED`
- `PINATA_UPLOAD_ENABLED`

Recommended defaults for dev/demo:
- `SOLANA_CLUSTER=devnet`
- `ANCHORING_ENABLED=false`
- `PINATA_UPLOAD_ENABLED=false`

## Health Endpoint

- `GET /v1/insurance/evidence/health`

Returns safe status fields:
- `pinataUploadEnabled`
- `anchoringEnabled`
- `solanaCluster`
- `mode` (`DISABLED_SAFE` or `READY`)

No secret values are returned.
