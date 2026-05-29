export interface SolanaAnchorResult {
  status: 'DISABLED_SAFE' | 'PENDING_ANCHOR' | 'ANCHORED' | 'ANCHOR_FAILED'
  chain: 'SOLANA'
  cluster: string
  txSignature?: string | null
  explorerUrl?: string | null
  reason?: string
}

function anchoringEnabled(): boolean {
  return String(process.env.ANCHORING_ENABLED ?? 'false').toLowerCase() === 'true'
}

export function getSolanaConfigStatus() {
  const enabled = anchoringEnabled()
  return {
    anchoringEnabled: enabled,
    cluster: process.env.SOLANA_CLUSTER ?? 'devnet',
    rpcUrlConfigured: Boolean(process.env.SOLANA_RPC_URL?.trim()),
    privateKeyConfigured: Boolean(process.env.SOLANA_WALLET_PRIVATE_KEY?.trim()),
  }
}

export async function anchorPayloadHashSafe(payloadHash: string): Promise<SolanaAnchorResult> {
  const config = getSolanaConfigStatus()
  if (!config.anchoringEnabled || !config.rpcUrlConfigured || !config.privateKeyConfigured) {
    return {
      status: 'DISABLED_SAFE',
      chain: 'SOLANA',
      cluster: config.cluster,
      reason: 'Anchoring disabled or missing Solana credentials',
    }
  }

  void payloadHash
  return {
    status: 'PENDING_ANCHOR',
    chain: 'SOLANA',
    cluster: config.cluster,
    reason: 'Asynchronous anchoring queue mode; live transaction not executed in this phase',
  }
}
