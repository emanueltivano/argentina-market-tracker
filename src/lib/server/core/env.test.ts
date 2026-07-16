import { afterEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = process.env

describe('server env', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    process.env = OLD_ENV
  })

  it('does not validate required env vars at module import time', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
    }
    vi.doMock('server-only', () => ({}))

    await expect(import('./env')).resolves.toHaveProperty('ENV')
  })

  it('validates API_URL lazily when it is read', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
    }
    vi.doMock('server-only', () => ({}))
    const { ENV } = await import('./env')

    expect(() => ENV.API_URL).toThrow('Missing API_URL')
  })

  it('uses a safe default favorites quote concurrency when env is missing', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
    }
    vi.doMock('server-only', () => ({}))
    const { ENV } = await import('./env')

    expect(ENV.FAVORITES_QUOTE_CONCURRENCY).toBe(4)
  })

  it('defaults market data source to demo when env is missing', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
    }
    vi.doMock('server-only', () => ({}))
    const { ENV, getRuntimeEnvSummary } = await import('./env')

    expect(ENV.MARKET_DATA_SOURCE).toBe('demo')
    expect(getRuntimeEnvSummary().marketDataSource).toBe('demo')
  })

  it('keeps live mode available when explicitly configured', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
      MARKET_DATA_SOURCE: 'live',
    }
    vi.doMock('server-only', () => ({}))
    const { ENV, getRuntimeEnvSummary } = await import('./env')

    expect(ENV.MARKET_DATA_SOURCE).toBe('live')
    expect(getRuntimeEnvSummary().missingLiveConfig).toContain('API_URL')
  })

  it('uses a configured favorites quote concurrency within range', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
      FAVORITES_QUOTE_CONCURRENCY: '6',
    }
    vi.doMock('server-only', () => ({}))
    const { ENV } = await import('./env')

    expect(ENV.FAVORITES_QUOTE_CONCURRENCY).toBe(6)
  })

  it('falls back to the safe default when favorites quote concurrency is invalid', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
      FAVORITES_QUOTE_CONCURRENCY: '99',
    }
    vi.doMock('server-only', () => ({}))
    let { ENV } = await import('./env')

    expect(ENV.FAVORITES_QUOTE_CONCURRENCY).toBe(4)

    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
      FAVORITES_QUOTE_CONCURRENCY: 'abc',
    }
    vi.doMock('server-only', () => ({}))
    ;({ ENV } = await import('./env'))

    expect(ENV.FAVORITES_QUOTE_CONCURRENCY).toBe(4)
  })

  it('preserves the previous parseInt semantics for favorites quote concurrency', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
      FAVORITES_QUOTE_CONCURRENCY: '6workers',
    }
    vi.doMock('server-only', () => ({}))
    const { ENV } = await import('./env')

    expect(ENV.FAVORITES_QUOTE_CONCURRENCY).toBe(6)
  })

  it('validates Redis timeout and negative quote cache TTL bounds', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
      RATE_LIMIT_REDIS_TIMEOUT_MS: '4500',
      STOCK_QUOTE_NOT_FOUND_TTL_MS: '60000',
    }
    vi.doMock('server-only', () => ({}))
    let { ENV } = await import('./env')

    expect(ENV.RATE_LIMIT_REDIS_TIMEOUT_MS).toBe(4500)
    expect(ENV.STOCK_QUOTE_NOT_FOUND_TTL_MS).toBe(60000)

    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
      RATE_LIMIT_REDIS_TIMEOUT_MS: '100',
      STOCK_QUOTE_NOT_FOUND_TTL_MS: '999999',
    }
    vi.doMock('server-only', () => ({}))
    ;({ ENV } = await import('./env'))

    expect(ENV.RATE_LIMIT_REDIS_TIMEOUT_MS).toBe(3000)
    expect(ENV.STOCK_QUOTE_NOT_FOUND_TTL_MS).toBe(30000)
  })

  it('strictly rejects partial integers for the new operational variables', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
      RATE_LIMIT_REDIS_TIMEOUT_MS: '2500ms',
      STOCK_QUOTE_NOT_FOUND_TTL_MS: '60000.5',
    }
    vi.doMock('server-only', () => ({}))
    const { ENV } = await import('./env')

    expect(ENV.RATE_LIMIT_REDIS_TIMEOUT_MS).toBe(3000)
    expect(ENV.STOCK_QUOTE_NOT_FOUND_TTL_MS).toBe(30000)
  })

  it('validates bounded fresh and stale cache windows as coherent pairs', async () => {
    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
      PANEL_CACHE_FRESH_TTL_MS: '20000',
      PANEL_CACHE_STALE_TTL_MS: '90000',
      STOCK_QUOTE_FRESH_TTL_MS: '10000',
      STOCK_QUOTE_STALE_TTL_MS: '60000',
    }
    vi.doMock('server-only', () => ({}))
    let { ENV } = await import('./env')

    expect(ENV.PANEL_CACHE_FRESH_TTL_MS).toBe(20000)
    expect(ENV.PANEL_CACHE_STALE_TTL_MS).toBe(90000)
    expect(ENV.STOCK_QUOTE_FRESH_TTL_MS).toBe(10000)
    expect(ENV.STOCK_QUOTE_STALE_TTL_MS).toBe(60000)

    vi.resetModules()
    process.env = {
      NODE_ENV: 'test',
      PANEL_CACHE_FRESH_TTL_MS: '90000',
      PANEL_CACHE_STALE_TTL_MS: '30000',
      STOCK_QUOTE_FRESH_TTL_MS: '-1',
      STOCK_QUOTE_STALE_TTL_MS: '1000',
    }
    vi.doMock('server-only', () => ({}))
    ;({ ENV } = await import('./env'))

    expect(ENV.PANEL_CACHE_FRESH_TTL_MS).toBe(30000)
    expect(ENV.PANEL_CACHE_STALE_TTL_MS).toBe(120000)
    expect(ENV.STOCK_QUOTE_FRESH_TTL_MS).toBe(15000)
    expect(ENV.STOCK_QUOTE_STALE_TTL_MS).toBe(120000)
  })
})
