import 'server-only'

type TokenRecord = {
  accessToken: string
  expiresAt: number
}

let token: TokenRecord | null = null
let inFlightTokenPromise: Promise<string> | null = null

export function getCachedToken(): string | null {
  if (!token || Date.now() >= token.expiresAt) {
    token = null
    return null
  }

  return token.accessToken
}

export function setCachedToken(
  accessToken: string,
  expiresInSec = 1800,
  skewSec = 30
) {
  if (!accessToken) {
    clearCachedToken()
    return
  }

  const ttlSec = Math.max(1, expiresInSec - skewSec)

  token = {
    accessToken,
    expiresAt: Date.now() + ttlSec * 1000,
  }
}

export function getOrCreateToken(fetchToken: () => Promise<string>): Promise<string> {
  const cached = getCachedToken()

  if (cached) {
    return Promise.resolve(cached)
  }

  if (inFlightTokenPromise) {
    return inFlightTokenPromise
  }

  const promise = fetchToken().finally(() => {
    if (inFlightTokenPromise === promise) {
      inFlightTokenPromise = null
    }
  })

  inFlightTokenPromise = promise
  return promise
}

export function clearCachedToken() {
  token = null
}

export function clearInFlightTokenRequest() {
  inFlightTokenPromise = null
}
