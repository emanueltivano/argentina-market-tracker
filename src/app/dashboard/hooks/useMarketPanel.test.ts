import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMarketPanelFetchError } from './useMarketPanel';

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

  it('falls back to a controlled HTTP message for invalid error payloads', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const error = await getMarketPanelFetchError(jsonResponse({ error: 'x' }));

    expect(error.message).toBe('Error del servidor (502) al cargar el panel.');
  });
});
