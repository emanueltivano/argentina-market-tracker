import { NextResponse, type NextRequest } from 'next/server'
import { canUseLocalDebug } from '@/lib/server/debug'
import { getCachedToken } from '@/lib/server/tokenCache'
import { logServerError } from '@/lib/server/observability'
import {
  IolTokenFormatError,
  IolTokenUpstreamError,
  refreshTokenForDebug,
} from '@/lib/server/iol'

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
export async function GET(req: NextRequest) {
  if (!canUseLocalDebug(req)) {
    return notFound()
  }

  const cached = getCachedToken()

  if (!cached) {
    return POST(req)
  }

  return NextResponse.json({
    ok: true,
    cached: true,
    expires_in: null,
    status: 'cached',
    message: 'Token is cached',
  })
}

export async function POST(req: NextRequest) {
  if (!canUseLocalDebug(req)) {
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
      logServerError('api.token.POST', err, {
        route: '/api/token',
        errorCode: 'TOKEN_UPSTREAM',
        status: err.status,
      })

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
      logServerError('api.token.POST', err, {
        route: '/api/token',
        errorCode: 'TOKEN_FORMAT',
      })

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

    logServerError('api.token.POST', err, {
      route: '/api/token',
      errorCode: 'TOKEN_ERROR',
    })

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
