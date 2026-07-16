import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCachedToken,
  clearInFlightTokenRequest,
} from './tokenCache'
import {
  getQuoteBySymbol,
  iol,
  isRecoverableIolUpstreamError,
  IolTokenFormatError,
  IolTokenUpstreamError,
  IolUpstreamAbortError,
  IolUpstreamHttpError,
  IolUpstreamNetworkError,
  IolUpstreamResponseError,
  IolUpstreamTimeoutError,
} from './iol'

const OLD_ENV = process.env

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, init)
}

function textResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, init)
}

function setRequiredEnv() {
  process.env = {
    ...OLD_ENV,
    API_URL: 'https://api.example.test',
    TOKEN_ENDPOINT: 'token',
    API_USERNAME: 'test-user',
    API_PASSWORD: 'super-secret-password',
    NODE_ENV: 'test',
  }
}

function upstreamHttpError(status: number) {
  return new IolUpstreamHttpError(`Upstream HTTP ${status}`, status, {
    statusText: `Status ${status}`,
    upstreamPath: 'api/v2/bCBA/Titulos/GGAL/Cotizacion',
  })
}

function tokenHttpError(status: number) {
  return new IolTokenUpstreamError(`Token HTTP ${status}`, status, {
    statusText: `Status ${status}`,
    upstreamPath: 'token',
  })
}

describe('isRecoverableIolUpstreamError', () => {
  it.each([
    ['controlled timeout', new IolUpstreamTimeoutError('timed out')],
    ['recognized network failure', new IolUpstreamNetworkError('offline')],
    ['typed invalid response', new IolUpstreamResponseError('invalid JSON')],
    ['invalid token format', new IolTokenFormatError('invalid token')],
    ['upstream HTTP 429', upstreamHttpError(429)],
    ['upstream HTTP 500', upstreamHttpError(500)],
    ['upstream HTTP 503', upstreamHttpError(503)],
    ['token HTTP 429', tokenHttpError(429)],
    ['token HTTP 500', tokenHttpError(500)],
  ])('classifies %s as recoverable', (_label, error) => {
    expect(isRecoverableIolUpstreamError(error)).toBe(true)
  })

  it.each([
    ['external abort', new IolUpstreamAbortError('aborted')],
    ['HTTP 401', upstreamHttpError(401)],
    ['HTTP 403', upstreamHttpError(403)],
    ['HTTP 400', upstreamHttpError(400)],
    ['HTTP 422', upstreamHttpError(422)],
    ['token HTTP 401', tokenHttpError(401)],
    ['token HTTP 403', tokenHttpError(403)],
    ['TypeError', new TypeError('programming error')],
    ['ReferenceError', new ReferenceError('programming error')],
    ['SyntaxError', new SyntaxError('untyped parse error')],
    ['generic Error', new Error('unknown failure')],
    ['plain object', { status: 503 }],
    ['string', 'network failed'],
    ['null', null],
    ['undefined', undefined],
  ])('classifies unknown or persistent %s as non-recoverable', (_label, error) => {
    expect(isRecoverableIolUpstreamError(error)).toBe(false)
  })

  it.each([
    ['upstream', upstreamHttpError(404)],
    ['token', tokenHttpError(404)],
  ])(
    'only classifies %s HTTP 404 as recoverable when allowNotFound is true',
    (_label, error) => {
      expect(isRecoverableIolUpstreamError(error)).toBe(false)
      expect(
        isRecoverableIolUpstreamError(error, { allowNotFound: false })
      ).toBe(false)
      expect(
        isRecoverableIolUpstreamError(error, { allowNotFound: true })
      ).toBe(true)
    }
  )

  it.each([401, 403, 400, 422])(
    'does not let allowNotFound change persistent HTTP %s classification',
    (status) => {
      expect(
        isRecoverableIolUpstreamError(upstreamHttpError(status), {
          allowNotFound: true,
        })
      ).toBe(false)
      expect(
        isRecoverableIolUpstreamError(tokenHttpError(status), {
          allowNotFound: true,
        })
      ).toBe(false)
    }
  )
})

function getFetchCall(index: number) {
  const fetchMock = vi.mocked(fetch)
  const call = fetchMock.mock.calls[index]

  if (!call) {
    throw new Error(`Missing fetch call at index ${index}`)
  }

  return call
}

function getRequestHeaders(index: number) {
  const [, init] = getFetchCall(index)

  return new Headers(init?.headers)
}

function getRequestBody(index: number) {
  const [, init] = getFetchCall(index)

  return init?.body
}

describe('iol server client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('server-only', () => ({}))
    setRequiredEnv()
    clearCachedToken()
    clearInFlightTokenRequest()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    clearCachedToken()
    clearInFlightTokenRequest()
    process.env = OLD_ENV
  })

  it('obtains a token and uses it for authenticated IOL requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'fresh-token', expires_in: 1800 })
        )
        .mockResolvedValueOnce(jsonResponse({ ok: true, value: 123 }))
    )

    await expect(iol('/panel')).resolves.toEqual({ ok: true, value: 123 })

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(getFetchCall(0)[0]).toBe('https://api.example.test/token')
    expect(getFetchCall(1)[0]).toBe('https://api.example.test/panel')
    expect(getRequestHeaders(1).get('authorization')).toBe('Bearer fresh-token')
    expect(getRequestHeaders(1).get('accept')).toBe('application/json')
    expect(String(getRequestBody(0))).toContain('username=test-user')
    expect(String(getRequestBody(0))).toContain('password=super-secret-password')
  })

  it('reuses a cached token while it is still valid', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'cached-token', expires_in: 1800 })
        )
        .mockResolvedValueOnce(jsonResponse({ first: true }))
        .mockResolvedValueOnce(jsonResponse({ second: true }))
    )

    await expect(iol('/panel/first')).resolves.toEqual({ first: true })
    await expect(iol('/panel/second')).resolves.toEqual({ second: true })

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(getFetchCall(0)[0]).toBe('https://api.example.test/token')
    expect(getFetchCall(1)[0]).toBe('https://api.example.test/panel/first')
    expect(getFetchCall(2)[0]).toBe('https://api.example.test/panel/second')
    expect(getRequestHeaders(1).get('authorization')).toBe('Bearer cached-token')
    expect(getRequestHeaders(2).get('authorization')).toBe('Bearer cached-token')
  })

  it('requests the individual quote endpoint for getQuoteBySymbol', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'fresh-token', expires_in: 1800 })
        )
        .mockResolvedValueOnce(
          jsonResponse({ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' })
        )
    )

    await expect(
      getQuoteBySymbol('bCBA', 'GGAL', {
        rateLimitIdentity: { key: 'client:test', source: 'local-loopback' },
        route: '/api/favorites',
      })
    ).resolves.toEqual({
      simbolo: 'GGAL',
      descripcion: 'Grupo Financiero Galicia',
    })

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(getFetchCall(1)[0]).toBe(
      'https://api.example.test/api/v2/bCBA/Titulos/GGAL/Cotizacion'
    )
  })

  it.each([401, 403])(
    'refreshes the token and retries once after a %s response',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(
            jsonResponse({ access_token: 'old-token', expires_in: 1800 })
          )
          .mockResolvedValueOnce(textResponse('auth failed', { status }))
          .mockResolvedValueOnce(
            jsonResponse({ access_token: 'new-token', expires_in: 1800 })
          )
          .mockResolvedValueOnce(jsonResponse({ ok: true }))
      )

      await expect(iol('/panel')).resolves.toEqual({ ok: true })

      expect(fetch).toHaveBeenCalledTimes(4)
      expect(getRequestHeaders(1).get('authorization')).toBe('Bearer old-token')
      expect(getRequestHeaders(3).get('authorization')).toBe('Bearer new-token')
    }
  )

  it('times out requests through AbortController', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      })
    )

    const promise = iol('/panel')
    const assertion = expect(promise).rejects.toThrow(
      'IOL token request timed out after 15000ms'
    )

    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
  })

  it('times out authenticated IOL requests after obtaining a token', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'fresh-token', expires_in: 1800 })
        )
        .mockImplementationOnce((_input: RequestInfo | URL, init?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          })
        })
    )

    const promise = iol('/panel')
    const assertion = expect(promise).rejects.toThrow(
      'IOL request timed out after 20000ms'
    )

    await vi.advanceTimersByTimeAsync(20_000)
    await assertion
  })

  it('throws a controlled error for invalid JSON IOL responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'fresh-token', expires_in: 1800 })
        )
        .mockResolvedValueOnce(textResponse('{invalid json'))
    )

    await expect(iol('/panel')).rejects.toThrow('IOL response was invalid')
  })

  it('does not include long upstream error bodies in error messages', async () => {
    const longBody = ` ${'x'.repeat(1_200)} `

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'fresh-token', expires_in: 1800 })
        )
        .mockResolvedValueOnce(textResponse(longBody, { status: 502 }))
    )

    await expect(iol('/panel')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(IolUpstreamHttpError)

      const typedError = error as IolUpstreamHttpError

      expect(typedError.message).toBe('IOL request failed: 502')
      expect(typedError.upstreamSummary).toBe('x'.repeat(512) + '…')

      return true
    })
  })

  it('does not include configured credentials in token error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          textResponse('invalid credentials', {
            status: 401,
            statusText: 'Unauthorized',
          })
        )
    )

    await expect(iol('/panel')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(IolTokenUpstreamError)

      const message = error instanceof Error ? error.message : String(error)

      expect(message).toContain('IOL token fetch failed: 401 Unauthorized')
      expect(message).not.toContain('test-user')
      expect(message).not.toContain('super-secret-password')
      expect(error).toMatchObject({
        upstreamPath: 'token',
      })

      return true
    })
  })

  it('does not leak configured credentials if an upstream error body echoes them', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'fresh-token', expires_in: 1800 })
        )
        .mockResolvedValueOnce(
          textResponse(
            'upstream echoed test-user and super-secret-password',
            { status: 500 }
          )
        )
    )

    await expect(iol('/panel')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(IolUpstreamHttpError)

      const typedError = error as IolUpstreamHttpError

      expect(typedError.message).toBe('IOL request failed: 500')
      expect(typedError.upstreamSummary).toBe(
        'upstream echoed [redacted] and [redacted]'
      )
      expect(String(typedError.upstreamSummary)).not.toContain('test-user')
      expect(String(typedError.upstreamSummary)).not.toContain(
        'super-secret-password'
      )

      return true
    })
  })

  it('redacts bearer tokens and jwt-like strings from upstream summaries', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'fresh-token', expires_in: 1800 })
        )
        .mockResolvedValueOnce(
          textResponse(
            'Authorization: Bearer top-secret-token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
            { status: 500 }
          )
        )
    )

    await expect(iol('/panel')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(IolUpstreamHttpError)

      const typedError = error as IolUpstreamHttpError
      const summary = String(typedError.upstreamSummary)

      expect(summary).toContain('Authorization: "Bearer [redacted]"')
      expect(summary).toContain('[redacted-jwt]')
      expect(summary).not.toContain('top-secret-token')

      return true
    })
  })

  it('requires live credentials when using the upstream client', async () => {
    process.env = {
      ...OLD_ENV,
      API_URL: 'https://api.example.test',
      TOKEN_ENDPOINT: 'token',
      NODE_ENV: 'test',
      API_USERNAME: '',
      API_PASSWORD: '',
    }
    vi.stubGlobal('fetch', vi.fn())

    await expect(iol('/panel')).rejects.toThrow('Missing API_USERNAME')
    expect(fetch).not.toHaveBeenCalled()
  })
})
