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
})
