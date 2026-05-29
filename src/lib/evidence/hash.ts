import { createHash } from 'node:crypto'

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

export function hashJsonStable(payload: unknown): string {
  return sha256Hex(stableJsonStringify(payload))
}

export function stableJsonStringify(payload: unknown): string {
  return JSON.stringify(sortDeep(payload))
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, sortDeep(child)])
    return Object.fromEntries(entries)
  }
  return value
}
