import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCachedToken,
  clearInFlightTokenRequest,
} from './tokenCache'
import {
  getQuoteBySymbol,
  iol,
  IolTokenUpstreamError,
  IolUpstreamHttpError,
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

    await expect(getQuoteBySymbol('bCBA', 'GGAL')).resolves.toEqual({
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

    await expect(iol('/panel')).rejects.toThrow(
      'IOL response: invalid JSON response'
    )
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
