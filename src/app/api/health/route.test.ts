import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = { ...process.env }

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init)
}

async function loadRoute(env: Record<string, string | undefined>) {
  vi.resetModules()
  process.env = {
    ...OLD_ENV,
    ...env,
  }
  vi.doMock('server-only', () => ({}))

  return import('./route')
}

describe('/api/health route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    process.env = OLD_ENV
  })

  it('responds in demo mode without live credentials', async () => {
    const { GET } = await loadRoute({
      MARKET_DATA_SOURCE: 'demo',
      NODE_ENV: 'test',
      API_URL: undefined,
      API_USERNAME: undefined,
      API_PASSWORD: undefined,
      PANEL_LIDER_ENDPOINT: undefined,
      PANEL_GENERAL_ENDPOINT: undefined,
      PANEL_CEDEARS_ENDPOINT: undefined,
    })

    const response = await GET(request('/api/health'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      status: 'ok',
      dataSource: 'demo',
      checks: {
        config: {
          missingLiveConfig: [],
          status: 'ok',
        },
        metrics: {
          processLocal: true,
        },
      },
    })
    expect(JSON.stringify(body)).not.toContain('API_PASSWORD')
    expect(response.headers.get('X-Request-Id')).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
  })

  it('reports degraded status when live configuration is incomplete', async () => {
    const { GET } = await loadRoute({
      MARKET_DATA_SOURCE: 'live',
      NODE_ENV: 'production',
      API_URL: 'https://api.example.test',
      API_USERNAME: undefined,
      API_PASSWORD: undefined,
      PANEL_LIDER_ENDPOINT: 'lider-endpoint',
      PANEL_GENERAL_ENDPOINT: undefined,
      PANEL_CEDEARS_ENDPOINT: 'cedears-endpoint',
    })

    const response = await GET(request('/api/health'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.checks.config).toEqual({
      missingLiveConfig: ['API_USERNAME', 'API_PASSWORD', 'PANEL_GENERAL_ENDPOINT'],
      status: 'degraded',
    })
    expect(JSON.stringify(body)).not.toContain('password')
  })
})
