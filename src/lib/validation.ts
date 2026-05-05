export function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value)
    if (Number.isFinite(parsedValue)) return parsedValue
  }

  return null
}

export function parsePositiveNumber(value: unknown): number | null {
  const parsedValue = parseFiniteNumber(value)
  if (parsedValue === null || parsedValue <= 0) return null
  return parsedValue
}

export function parseTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const normalizedValue = value.trim()
  if (!normalizedValue) return null
  return normalizedValue
}

export function isValidJsonString(value: unknown): boolean {
  if (typeof value !== 'string') return false

  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

export function hasDefinedValue(value: Record<string, unknown>): boolean {
  return Object.values(value).some(item => item !== undefined)
}

export function hasForbiddenKey(
  value: Record<string, unknown>,
  forbiddenKeys: string[]
): boolean {
  return forbiddenKeys.some(key => Object.prototype.hasOwnProperty.call(value, key))
}
