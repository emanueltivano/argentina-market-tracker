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
})
