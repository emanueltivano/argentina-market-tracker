import 'server-only'
import { normalizeServerUrl } from '@/lib/server/core/serverUrl'

const DEVELOPMENT_SITE_URL = 'http://localhost:3000'

function normalizePublicOrigin(
  value: string,
  options: { allowInsecure: boolean; variableName: string }
): string {
  return normalizeServerUrl(value, {
    allowPathname: false,
    httpPolicy: 'public-origin',
    nodeEnv: options.allowInsecure ? 'development' : 'production',
    originDescription: 'the public origin',
    variableName: options.variableName,
  })
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
