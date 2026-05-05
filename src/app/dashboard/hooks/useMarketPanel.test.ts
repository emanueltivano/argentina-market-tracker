import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMarketPanel, getMarketPanelFetchError } from './useMarketPanel';

function jsonResponse(body: unknown, status = 502): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('getMarketPanelFetchError', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps backend panel errors to a user-facing message', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const error = await getMarketPanelFetchError(
      jsonResponse({
        ok: false,
        error: 'PANEL_ERROR',
        details: 'sensitive upstream detail',
      }),
    );

    expect(error.message).toBe('No se pudo cargar el panel de mercado.');
  });

  it('can include backend details in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const error = await getMarketPanelFetchError(
      jsonResponse({
        ok: false,
        error: 'PANEL_ERROR',
        details: 'upstream failed',
      }),
    );

    expect(error.message).toBe(
      'No se pudo cargar el panel de mercado. Detalle: upstream failed',
    );
  });

  it('maps rate limit errors to a specific message', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const error = await getMarketPanelFetchError(
      jsonResponse(
        {
          ok: false,
          error: 'RATE_LIMITED',
        },
        429,
      ),
    );

    expect(error.message).toBe(
      'Demasiadas solicitudes. Esperá unos segundos e intentá nuevamente.',
    );
  });

  it('maps refresh cooldown errors to a specific message', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const error = await getMarketPanelFetchError(
      jsonResponse(
        {
          ok: false,
          error: 'REFRESH_COOLDOWN',
        },
        429,
      ),
    );

    expect(error.message).toBe(
      'Actualización reciente. Esperá unos segundos e intentá nuevamente.',
    );
  });

  it('maps invalid panel type errors to a specific message', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const error = await getMarketPanelFetchError(
      jsonResponse(
        {
          ok: false,
          error: 'INVALID_PANEL_TYPE',
        },
        400,
      ),
    );

    expect(error.message).toBe('Panel de mercado inválido.');
  });

  it('falls back to a controlled HTTP message for invalid error payloads', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const error = await getMarketPanelFetchError(jsonResponse({ error: 'x' }));

    expect(error.message).toBe('Error del servidor (502) al cargar el panel.');
  });
});

describe('fetchMarketPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a valid backend success response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            ok: true,
            data: [
              {
                simbolo: 'GGAL',
                descripcion: 'Grupo Financiero Galicia',
                ultimoPrecio: 4200.5,
                variacionPorcentual: 1.25,
                puntas: {
                  cantidadCompra: 10,
                  precioCompra: 4200,
                  precioVenta: 4210,
                  cantidadVenta: 20,
                },
              },
            ],
            fetchedAt: '2026-05-04T16:00:00.000Z',
            servedAt: '2026-05-04T16:00:01.000Z',
            cacheStatus: 'fresh',
          },
          200,
        ),
      ),
    );

    await expect(fetchMarketPanel('/api/panel?type=lider')).resolves.toEqual({
      ok: true,
      data: [
        {
          simbolo: 'GGAL',
          descripcion: 'Grupo Financiero Galicia',
          ultimoPrecio: 4200.5,
          variacionPorcentual: 1.25,
          puntas: {
            cantidadCompra: 10,
            precioCompra: 4200,
            precioVenta: 4210,
            cantidadVenta: 20,
          },
        },
      ],
      fetchedAt: '2026-05-04T16:00:00.000Z',
      servedAt: '2026-05-04T16:00:01.000Z',
      cacheStatus: 'fresh',
    });
  });

  it('rejects success responses when data is not an array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            ok: true,
            data: { simbolo: 'GGAL' },
            fetchedAt: '2026-05-04T16:00:00.000Z',
            servedAt: '2026-05-04T16:00:01.000Z',
            cacheStatus: 'fresh',
          },
          200,
        ),
      ),
    );

    await expect(fetchMarketPanel('/api/panel?type=lider')).rejects.toThrow(
      'Respuesta inválida del servidor: data debe ser un array.',
    );
  });

  it('rejects success responses with an invalid item inside data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            ok: true,
            data: [
              {
                simbolo: 'GGAL',
                descripcion: 'Grupo Financiero Galicia',
              },
              {
                simbolo: '',
                descripcion: 'Missing ticker',
              },
            ],
            fetchedAt: '2026-05-04T16:00:00.000Z',
            servedAt: '2026-05-04T16:00:01.000Z',
            cacheStatus: 'memory-cache',
          },
          200,
        ),
      ),
    );

    await expect(fetchMarketPanel('/api/panel?type=lider')).rejects.toThrow(
      'Respuesta inválida del servidor: item de panel inválido.',
    );
  });

  it('throws a specific user-facing message for backend errors', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            ok: false,
            error: 'REFRESH_COOLDOWN',
          },
          429,
        ),
      ),
    );

    await expect(fetchMarketPanel('/api/panel?type=lider&refresh=1')).rejects.toThrow(
      'Actualización reciente. Esperá unos segundos e intentá nuevamente.',
    );
  });
});
