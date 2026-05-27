import 'server-only'

export type MarketDataSource = 'demo' | 'live'
const LIVE_ENV_KEYS = [
  'API_URL',
  'API_USERNAME',
  'API_PASSWORD',
  'PANEL_LIDER_ENDPOINT',
  'PANEL_GENERAL_ENDPOINT',
  'PANEL_CEDEARS_ENDPOINT',
] as const

function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

function normalizePath(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function getMarketDataSource(): MarketDataSource {
  const value = (process.env.MARKET_DATA_SOURCE ?? 'live').trim()

  if (value === 'demo' || value === 'live') {
    return value
  }

  throw new Error('MARKET_DATA_SOURCE must be one of demo or live')
}

function optionalTrimmed(name: string): string {
  return process.env[name]?.trim() ?? ''
}

export function getRuntimeEnvSummary() {
  let marketDataSource: MarketDataSource | 'invalid' = 'invalid'
  let marketDataSourceError: string | null = null

  try {
    marketDataSource = getMarketDataSource()
  } catch (error: unknown) {
    marketDataSourceError =
      error instanceof Error ? error.message : String(error ?? 'unknown')
  }

  const missingLiveConfig =
    marketDataSource === 'live'
      ? LIVE_ENV_KEYS.filter((key) => optionalTrimmed(key).length === 0)
      : []

  return {
    appVersion:
      optionalTrimmed('APP_VERSION') || optionalTrimmed('npm_package_version') || null,
    marketDataSource,
    marketDataSourceError,
    metricsDebugTokenConfigured: optionalTrimmed('OBSERVABILITY_DEBUG_TOKEN').length > 0,
    missingLiveConfig,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    rateLimitRedisConfigured:
      optionalTrimmed('RATE_LIMIT_REDIS_REST_URL').length > 0 &&
      optionalTrimmed('RATE_LIMIT_REDIS_REST_TOKEN').length > 0,
  }
}

export const ENV = {
  get MARKET_DATA_SOURCE() {
    return getMarketDataSource()
  },

  get API_URL() {
    return normalizeBaseUrl(required('API_URL'))
  },

  get TOKEN_ENDPOINT() {
    return normalizePath(process.env.TOKEN_ENDPOINT ?? 'token')
  },

  get API_USERNAME() {
    return required('API_USERNAME')
  },

  get API_PASSWORD() {
    return required('API_PASSWORD')
  },

  get PANEL_LIDER_ENDPOINT() {
    return normalizePath(required('PANEL_LIDER_ENDPOINT'))
  },

  get PANEL_GENERAL_ENDPOINT() {
    return normalizePath(required('PANEL_GENERAL_ENDPOINT'))
  },

  get PANEL_CEDEARS_ENDPOINT() {
    return normalizePath(required('PANEL_CEDEARS_ENDPOINT'))
  },

  get NODE_ENV() {
    return process.env.NODE_ENV ?? 'development'
  },

  get RATE_LIMIT_STORE() {
    return process.env.RATE_LIMIT_STORE ?? 'auto'
  },

  get RATE_LIMIT_REDIS_REST_URL() {
    return process.env.RATE_LIMIT_REDIS_REST_URL ?? ''
  },

  get RATE_LIMIT_REDIS_REST_TOKEN() {
    return process.env.RATE_LIMIT_REDIS_REST_TOKEN ?? ''
  },

  get RATE_LIMIT_TRUSTED_PROXY() {
    return process.env.RATE_LIMIT_TRUSTED_PROXY ?? ''
  },

  get OBSERVABILITY_DEBUG_TOKEN() {
    return optionalTrimmed('OBSERVABILITY_DEBUG_TOKEN')
  },

  get APP_VERSION() {
    return optionalTrimmed('APP_VERSION') || optionalTrimmed('npm_package_version')
  },
}
