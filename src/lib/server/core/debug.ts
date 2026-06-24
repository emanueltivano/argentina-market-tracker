import 'server-only'

import { ENV } from './env'

type LocalDebugRequest = {
  nextUrl: {
    hostname: string
  }
}

export function isDebugEnabled() {
  return ENV.NODE_ENV !== 'production' && process.env.ENABLE_TOKEN_DEBUG === '1'
}

export function isLocalDebugRequest(req: LocalDebugRequest): boolean {
  const host = req.nextUrl.hostname

  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

export function canUseLocalDebug(req: LocalDebugRequest): boolean {
  return isDebugEnabled() && isLocalDebugRequest(req)
}
