import 'server-only'

const DEVELOPMENT_SITE_URL = 'http://localhost:3000'

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function normalizePublicOrigin(
  value: string,
  options: { allowInsecure: boolean; variableName: string }
): string {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${options.variableName} must be a valid absolute URL`)
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${options.variableName} must use http or https`)
  }

  if (
    url.protocol === 'http:' &&
    !options.allowInsecure &&
    !isLoopbackHostname(url.hostname)
  ) {
    throw new Error(`${options.variableName} must use https in production`)
  }

  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${options.variableName} must contain only the public origin`)
  }

  return url.origin
}

function getVercelOrigin(
  env: NodeJS.ProcessEnv
): { value: string; variableName: string } | null {
  const productionUrl = env.VERCEL_PROJECT_PRODUCTION_URL?.trim()

  if (productionUrl) {
    return {
      value: `https://${productionUrl}`,
      variableName: 'VERCEL_PROJECT_PRODUCTION_URL',
    }
  }

  const previewUrl = env.VERCEL_URL?.trim()

  return previewUrl
    ? { value: `https://${previewUrl}`, variableName: 'VERCEL_URL' }
    : null
}

export function getPublicSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const isProduction = env.NODE_ENV === 'production'
  const explicitUrl = env.NEXT_PUBLIC_SITE_URL?.trim()

  if (explicitUrl) {
    return normalizePublicOrigin(explicitUrl, {
      allowInsecure: !isProduction,
      variableName: 'NEXT_PUBLIC_SITE_URL',
    })
  }

  const vercelOrigin = getVercelOrigin(env)

  if (vercelOrigin) {
    return normalizePublicOrigin(vercelOrigin.value, {
      allowInsecure: false,
      variableName: vercelOrigin.variableName,
    })
  }

  if (!isProduction) {
    return DEVELOPMENT_SITE_URL
  }

  throw new Error(
    'A public site URL is required in production. Configure NEXT_PUBLIC_SITE_URL or a Vercel deployment URL.'
  )
}

export function getAbsoluteSiteUrl(
  pathname: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return new URL(pathname, `${getPublicSiteUrl(env)}/`).toString()
}
