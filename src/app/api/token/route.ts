import { NextResponse } from 'next/server'
import { getCachedToken } from '@/lib/server/tokenCache'
import { ENV } from '@/lib/server/env'
import {
  IolTokenFormatError,
  IolTokenUpstreamError,
  refreshTokenForDebug,
} from '@/lib/server/iol'

function isEnabled() {
  return ENV.NODE_ENV !== 'production' && process.env.ENABLE_TOKEN_DEBUG === '1'
}

function notFound() {
  return NextResponse.json(
    {
      ok: false,
      error: 'NOT_FOUND',
    },
    { status: 404 }
  )
}

function isSafeTokenType(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 32 &&
    /^[A-Za-z][A-Za-z0-9_.-]*$/.test(value)
  )
}

// Debug local only: never expose full OAuth tokens from this route.
export async function GET() {
  if (!isEnabled()) {
    return notFound()
  }

  const cached = getCachedToken()

  if (!cached) {
    return POST()
  }

  return NextResponse.json({
    ok: true,
    cached: true,
    expires_in: null,
    status: 'cached',
    message: 'Token is cached',
  })
}

export async function POST() {
  if (!isEnabled()) {
    return notFound()
  }

  try {
    const token = await refreshTokenForDebug()

    return NextResponse.json({
      ok: true,
      expires_in: token.expiresIn,
      ...(isSafeTokenType(token.tokenType) ? { token_type: token.tokenType } : {}),
      cached: false,
      status: 'refreshed',
      message: 'Token fetched and cached',
    })
  } catch (err: unknown) {
    if (err instanceof IolTokenUpstreamError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'TOKEN_UPSTREAM',
          status: err.status,
        },
        { status: 502 }
      )
    }

    if (err instanceof IolTokenFormatError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'TOKEN_FORMAT',
          details: err.message,
        },
        { status: 502 }
      )
    }

    const message = err instanceof Error ? err.message : String(err ?? 'unknown')

    return NextResponse.json(
      {
        ok: false,
        error: 'TOKEN_ERROR',
        details: message,
      },
      { status: 500 }
    )
  }
}
