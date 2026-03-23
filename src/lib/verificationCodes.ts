// In-memory store (use Redis in production)
const codes = new Map<string, { code: string; expiresAt: number; firstName: string }>()

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function storeCode(email: string, code: string, firstName: string) {
  codes.set(email, {
    code,
    expiresAt: Date.now() + 15 * 60 * 1000,
    firstName,
  })
}

export function verifyCode(email: string, code: string): boolean {
  const stored = codes.get(email)
  if (!stored) return false
  if (Date.now() > stored.expiresAt) {
    codes.delete(email)
    return false
  }
  if (stored.code !== code) return false
  codes.delete(email)
  return true
}
