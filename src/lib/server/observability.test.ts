import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractUpstreamErrorSummary,
  getRequestId,
  isValidRequestId,
  logServerError,
  observabilityTestExports,
  sanitizeLogString,
} from './observability'

const OLD_ENV = process.env

function request(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) {
  return new NextRequest(`http://localhost${path}`, init)
}

describe('observability', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('server-only', () => ({}))
    process.env = {
      ...OLD_ENV,
      API_USERNAME: 'test-user',
      API_PASSWORD: 'test-password',
      RATE_LIMIT_REDIS_REST_TOKEN: 'redis-secret-token',
      NODE_ENV: 'test',
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = OLD_ENV
  })

  it('redacts common secrets from raw strings', () => {
    const message = sanitizeLogString(
      'Authorization: Bearer abc.def.ghi access_token=tok123 refresh_token=tok456 password=hunter2 secret=sauce api_key=key123 client_secret=secret123 cookie=session=abc test-user test-password redis-secret-token'
    )

    expect(message).toContain('Authorization: "Bearer [redacted]"')
    expect(message).toContain('access_token="[redacted]"')
    expect(message).toContain('refresh_token="[redacted]"')
    expect(message).toContain('password="[redacted]"')
    expect(message).toContain('secret="[redacted]"')
    expect(message).toContain('api_key="[redacted]"')
    expect(message).toContain('client_secret="[redacted]"')
    expect(message).toContain('cookie="[redacted]"')
    expect(message).not.toContain('test-user')
    expect(message).not.toContain('test-password')
    expect(message).not.toContain('redis-secret-token')
  })

  it('redacts jwt-like strings and sensitive object fields', () => {
    const value = observabilityTestExports.sanitizeLogValue({
      authorization: 'Bearer top-secret-token',
      cookie: 'session=abc',
      nested: {
        access_token: 'tok123',
        accountId: '123456789',
        jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
      },
    })

    expect(value).toEqual({
      authorization: '[redacted]',
      cookie: '[redacted]',
      nested: {
        access_token: '[redacted]',
        accountId: '[redacted]',
        jwt: '[redacted-jwt]',
      },
    })
  })

  it('extracts a sanitized allowlist summary from upstream json bodies', () => {
    expect(
      extractUpstreamErrorSummary(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Authorization: Bearer top-secret-token',
          access_token: 'should-not-appear',
          account_id: '123456',
        })
      )
    ).toEqual({
      error: 'invalid_grant',
      error_description: 'Authorization: "Bearer [redacted]"',
    })
  })

  it('uses a valid inbound x-request-id and rejects invalid values', () => {
    const validRequestId = 'req-12345678'
    const valid = request('/api/panel', {
      headers: { 'x-request-id': validRequestId },
    })
    const invalid = request('/api/panel', {
      headers: { 'x-request-id': 'bad id with spaces' },
    })

    expect(isValidRequestId(validRequestId)).toBe(true)
    expect(getRequestId(valid)).toBe(validRequestId)
    expect(getRequestId(invalid)).not.toBe('bad id with spaces')
    expect(isValidRequestId(getRequestId(invalid))).toBe(true)
  })

  it('logs structured sanitized errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const error = new Error(
      'Authorization: Bearer top-secret-token password=hunter2'
    )

    logServerError('api.panel.GET', error, {
      requestId: 'req-12345678',
      route: '/api/panel',
      headers: new Headers({
        authorization: 'Bearer top-secret-token',
        'x-trace': 'trace-1',
      }),
    })

    expect(consoleError).toHaveBeenCalledWith(
      '[api.panel.GET]',
      expect.objectContaining({
        level: 'error',
        requestId: 'req-12345678',
        route: '/api/panel',
        headers: {
          authorization: '[redacted]',
          'x-trace': 'trace-1',
        },
        error: expect.objectContaining({
          message:
            'Authorization: "Bearer [redacted]" password="[redacted]"',
        }),
      })
    )
  })
})
