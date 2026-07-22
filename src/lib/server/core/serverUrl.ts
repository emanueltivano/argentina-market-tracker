import 'server-only'

export type ServerUrlHttpPolicy = 'public-origin' | 'sensitive'

export function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  )
}

export function normalizeServerUrl(
  value: string,
  options: {
    allowPathname: boolean
    httpPolicy: ServerUrlHttpPolicy
    nodeEnv: string
    originDescription?: string
    variableName: string
  }
): string {
  let url: URL

  try {
    url = new URL(value.trim())
  } catch {
    throw new Error(`${options.variableName} must be a valid absolute URL`)
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${options.variableName} must use http or https`)
  }

  if (url.username || url.password) {
    throw new Error(`${options.variableName} must not include credentials`)
  }

  if (url.search) {
    throw new Error(`${options.variableName} must not include a query string`)
  }

  if (url.hash) {
    throw new Error(`${options.variableName} must not include a fragment`)
  }

  if (!options.allowPathname && url.pathname !== '/') {
    throw new Error(
      `${options.variableName} must contain only ${options.originDescription ?? 'an origin'}`
    )
  }

  if (url.protocol === 'http:') {
    const loopback = isLoopbackHostname(url.hostname)
    const isProduction = options.nodeEnv === 'production'
    const allowed =
      options.httpPolicy === 'public-origin'
        ? !isProduction || loopback
        : !isProduction && loopback

    if (!allowed) {
      throw new Error(
        isProduction
          ? `${options.variableName} must use https in production`
          : `${options.variableName} may use http only for loopback in development or tests`
      )
    }
  }

  if (!options.allowPathname || url.pathname === '/') {
    return url.origin
  }

  const normalizedPathname = url.pathname.replace(/\/+$/, '')
  return `${url.origin}${normalizedPathname}`
}
