export interface PinataUploadResult {
  ok: boolean
  status: 'DISABLED' | 'READY' | 'UPLOADED' | 'FAILED'
  provider: 'PINATA'
  reason?: string
  ipfsCid?: string
}

function pinataEnabled(): boolean {
  return String(process.env.PINATA_UPLOAD_ENABLED ?? 'false').toLowerCase() === 'true'
}

export function getPinataConfigStatus() {
  const enabled = pinataEnabled()
  const hasJwt = Boolean(process.env.PINATA_JWT?.trim())
  return {
    pinataUploadEnabled: enabled,
    hasJwt,
    gatewayUrl: process.env.PINATA_GATEWAY_URL ?? 'https://gateway.pinata.cloud/ipfs/',
  }
}

export async function uploadJsonToPinataSafe(payload: unknown): Promise<PinataUploadResult> {
  const config = getPinataConfigStatus()
  if (!config.pinataUploadEnabled || !config.hasJwt) {
    return {
      ok: false,
      status: 'DISABLED',
      provider: 'PINATA',
      reason: 'Pinata upload is disabled or PINATA_JWT is missing',
    }
  }

  void payload
  return {
    ok: false,
    status: 'READY',
    provider: 'PINATA',
    reason: 'Pinata upload service not implemented in this foundation phase',
  }
}
