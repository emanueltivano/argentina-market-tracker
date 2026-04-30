import { NextResponse } from 'next/server'
import { getCachedToken, setCachedToken } from '@/lib/server/tokenCache'
import { ENV } from '@/lib/server/env'

const TOKEN_TIMEOUT = 15_000

function isEnabled() {
  return ENV.NODE_ENV !== 'production' && process.env.ENABLE_TOKEN_DEBUG === '1'
}

function methodNotAllowed() {
  return NextResponse.json(
    {
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
    },
    {
      status: 405,
      headers: { Allow: 'GET, POST' },
    }
  )
}

export async function GET() {
  if (!isEnabled()) {
    return methodNotAllowed()
  }

  const cached = getCachedToken()

  if (!cached) {
    return POST()
  }

  return NextResponse.json({
    ok: true,
    cached: true,
    status: 'cached',
    message: 'Token is cached',
  })
}

export async function POST() {
  if (!isEnabled()) {
    return methodNotAllowed()
  }

  const url = new URL(ENV.TOKEN_ENDPOINT, `${ENV.API_URL}/`)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TOKEN_TIMEOUT)

  try {
    const body = new URLSearchParams({
      username: ENV.API_USERNAME,
      password: ENV.API_PASSWORD,
      grant_type: 'password',
    })

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: ctrl.signal,
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'TOKEN_UPSTREAM',
          status: res.status,
        },
        { status: 502 }
      )
    }

    const data: unknown = await res.json()

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        {
          ok: false,
          error: 'TOKEN_FORMAT',
          details: 'Invalid token response',
        },
        { status: 502 }
      )
    }

    const tokenData = data as Record<string, unknown>
    const accessToken = tokenData.access_token
    const tokenType = tokenData.token_type
    const expiresIn = Number(tokenData.expires_in ?? 1800)
    const ttl = Number.isFinite(expiresIn) ? expiresIn : 1800

    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'TOKEN_FORMAT',
          details: 'Missing access_token',
        },
        { status: 502 }
      )
    }

    setCachedToken(accessToken, ttl)

    return NextResponse.json({
      ok: true,
      expires_in: ttl,
      ...(typeof tokenType === 'string' ? { token_type: tokenType } : {}),
      cached: false,
      status: 'refreshed',
      message: 'Token fetched and cached',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? 'unknown')

    return NextResponse.json(
      {
        ok: false,
        error: 'TOKEN_ERROR',
        details: message,
      },
      { status: 500 }
    )
  } finally {
    clearTimeout(timer)
  }
}
