import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = process.env

function setRequiredEnv(nodeEnv: NodeJS.ProcessEnv['NODE_ENV'] = 'test') {
  process.env = {
    ...OLD_ENV,
    API_URL: 'https://api.example.test',
    TOKEN_ENDPOINT: 'token',
    API_USERNAME: 'user',
    API_PASSWORD: 'password',
    NODE_ENV: nodeEnv,
  }
}

function request(path: string) {
  return new NextRequest(`http://localhost${path}`)
}

function context(symbol: string) {
  return {
    params: Promise.resolve({ symbol }),
  }
}

async function loadRoute(
  iolFetch: ReturnType<typeof vi.fn>,
  nodeEnv: NodeJS.ProcessEnv['NODE_ENV'] = 'test'
) {
  vi.resetModules()
  setRequiredEnv(nodeEnv)
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/server/iol', () => ({ iolFetch }))

  return import('./route')
}

describe('/api/stocks/[symbol]/history route', () => {
  beforeEach(() => {
    setRequiredEnv()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T15:00:00.000Z'))
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.resetModules()
    process.env = OLD_ENV
  })

  it('fetches adjusted historical data through IOL and normalizes it', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      {
        fecha: '2026-05-07T00:00:00',
        ultimoPrecio: 101,
        apertura: 98,
        maximo: 102,
        minimo: 97,
        volumen: 1000,
      },
    ])
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(
      request('/api/stocks/GGAL/history?range=1M&market=bCBA'),
      context('GGAL')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      data: [
        {
          date: '2026-05-07',
          close: 101,
          open: 98,
          high: 102,
          low: 97,
          volume: 1000,
        },
      ],
      fetchedAt: '2026-05-07T15:00:00.000Z',
      servedAt: '2026-05-07T15:00:00.000Z',
      cacheStatus: 'fresh',
      range: '1M',
      market: 'bCBA',
      symbol: 'GGAL',
    })
    expect(iolFetch).toHaveBeenCalledWith(
      '/api/v2/bCBA/Titulos/GGAL/Cotizacion/seriehistorica/2026-04-06/2026-05-07/ajustada'
    )
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('uses the same bCBA market endpoint for a panel general stock', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { fecha: '2026-05-07', ultimoPrecio: 101 },
    ])
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(
      request('/api/stocks/YPFD/history?range=1M&market=bCBA'),
      context('YPFD')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.symbol).toBe('YPFD')
    expect(body.market).toBe('bCBA')
    expect(iolFetch).toHaveBeenCalledWith(
      '/api/v2/bCBA/Titulos/YPFD/Cotizacion/seriehistorica/2026-04-06/2026-05-07/ajustada'
    )
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('uses bCBA and normalizes alternate CEDEAR historical fields', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      {
        fechaCotizacion: '2026-05-07T00:00:00',
        precio: 916,
      },
    ])
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(
      request('/api/stocks/AAPL/history?range=1M&market=bCBA'),
      context('AAPL')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      data: [{ date: '2026-05-07', close: 916 }],
      market: 'bCBA',
      symbol: 'AAPL',
    })
    expect(iolFetch).toHaveBeenCalledWith(
      '/api/v2/bCBA/Titulos/AAPL/Cotizacion/seriehistorica/2026-04-06/2026-05-07/ajustada'
    )
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('falls back to unadjusted history when adjusted CEDEAR history is empty', async () => {
    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          fechaCotizacion: '2026-05-07T00:00:00',
          precio: 916,
        },
      ])
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(
      request('/api/stocks/AAPL/history?range=1M&market=bCBA'),
      context('AAPL')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      data: [{ date: '2026-05-07', close: 916 }],
      market: 'bCBA',
      symbol: 'AAPL',
    })
    expect(iolFetch).toHaveBeenNthCalledWith(
      1,
      '/api/v2/bCBA/Titulos/AAPL/Cotizacion/seriehistorica/2026-04-06/2026-05-07/ajustada'
    )
    expect(iolFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v2/bCBA/Titulos/AAPL/Cotizacion/seriehistorica/2026-04-06/2026-05-07/sinAjustar'
    )
  })

  it('uses defaults for market and range', async () => {
    const iolFetch = vi.fn().mockResolvedValue([])
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(request('/api/stocks/ypfd/history'), context('ypfd'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.range).toBe('1M')
    expect(body.market).toBe('bCBA')
    expect(body.symbol).toBe('YPFD')
  })

  it('returns an empty data array when both IOL history variants are empty', async () => {
    const iolFetch = vi.fn().mockResolvedValue([])
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(
      request('/api/stocks/MSFT/history?range=1M&market=bCBA'),
      context('MSFT')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      data: [],
      market: 'bCBA',
      symbol: 'MSFT',
    })
    expect(iolFetch).toHaveBeenNthCalledWith(
      1,
      '/api/v2/bCBA/Titulos/MSFT/Cotizacion/seriehistorica/2026-04-06/2026-05-07/ajustada'
    )
    expect(iolFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v2/bCBA/Titulos/MSFT/Cotizacion/seriehistorica/2026-04-06/2026-05-07/sinAjustar'
    )
  })

  it('returns 400 for invalid inputs', async () => {
    const iolFetch = vi.fn()
    const { GET } = await loadRoute(iolFetch)

    expect(
      (await GET(request('/api/stocks/GGAL/history?range=2Y'), context('GGAL')))
        .status
    ).toBe(400)
    expect(
      (
        await GET(
          request('/api/stocks/GGAL/history?market=../bad'),
          context('GGAL')
        )
      ).status
    ).toBe(400)
    expect(
      (await GET(request('/api/stocks/*/history'), context('*'))).status
    ).toBe(400)
    expect(iolFetch).not.toHaveBeenCalled()
  })

  it('uses memory cache for repeated requests', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { fecha: '2026-05-07', ultimoPrecio: 101 },
    ])
    const { GET } = await loadRoute(iolFetch)

    await GET(request('/api/stocks/GGAL/history?range=1W'), context('GGAL'))
    const response = await GET(
      request('/api/stocks/GGAL/history?range=1W'),
      context('GGAL')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.cacheStatus).toBe('memory-cache')
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('caches a fallback history response without repeating either variant', async () => {
    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ fecha: '2026-05-07', ultimoPrecio: 101 }])
    const { GET } = await loadRoute(iolFetch)

    await GET(request('/api/stocks/AAPL/history?range=1W'), context('AAPL'))
    const response = await GET(
      request('/api/stocks/AAPL/history?range=1W'),
      context('AAPL')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.cacheStatus).toBe('memory-cache')
    expect(body.data).toEqual([{ date: '2026-05-07', close: 101 }])
    expect(iolFetch).toHaveBeenCalledTimes(2)
  })

  it('does not expose upstream error details in production', async () => {
    const iolFetch = vi.fn().mockRejectedValue(new Error('upstream failed'))
    const { GET } = await loadRoute(iolFetch, 'production')

    const response = await GET(
      request('/api/stocks/GGAL/history'),
      context('GGAL')
    )

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      ok: false,
      error: 'HISTORY_ERROR',
    })
  })

  it('returns 405 and Allow GET for POST requests', async () => {
    const iolFetch = vi.fn()
    const { POST } = await loadRoute(iolFetch)

    const response = POST()

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET')
    expect(await response.json()).toEqual({
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
    })
  })
})
