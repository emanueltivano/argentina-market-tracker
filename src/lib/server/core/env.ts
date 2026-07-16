import 'server-only'

export type MarketDataSource = 'demo' | 'live'
const DEFAULT_FAVORITES_QUOTE_CONCURRENCY = 4
const MIN_FAVORITES_QUOTE_CONCURRENCY = 1
const MAX_FAVORITES_QUOTE_CONCURRENCY = 10
const DEFAULT_RATE_LIMIT_REDIS_TIMEOUT_MS = 3_000
const MIN_RATE_LIMIT_REDIS_TIMEOUT_MS = 2_000
const MAX_RATE_LIMIT_REDIS_TIMEOUT_MS = 5_000
const DEFAULT_STOCK_QUOTE_NOT_FOUND_TTL_MS = 30_000
const MIN_STOCK_QUOTE_NOT_FOUND_TTL_MS = 1_000
const MAX_STOCK_QUOTE_NOT_FOUND_TTL_MS = 5 * 60_000
const DEFAULT_PANEL_CACHE_FRESH_TTL_MS = 30_000
const DEFAULT_PANEL_CACHE_STALE_TTL_MS = 2 * 60_000
const DEFAULT_STOCK_QUOTE_FRESH_TTL_MS = 15_000
const DEFAULT_STOCK_QUOTE_STALE_TTL_MS = 2 * 60_000
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
  const value = (process.env.MARKET_DATA_SOURCE ?? 'demo').trim()

  if (value === 'demo' || value === 'live') {
    return value
  }

  throw new Error('MARKET_DATA_SOURCE must be one of demo or live')
}

function optionalTrimmed(name: string): string {
  return process.env[name]?.trim() ?? ''
}

function getBoundedIntegerEnv(
  name: string,
  defaultValue: number,
  options: {
    min: number
    max: number
  }
): number {
  const rawValue = optionalTrimmed(name)

  if (!rawValue) {
    return defaultValue
  }

  const parsed = Number.parseInt(rawValue, 10)

  if (
    !Number.isFinite(parsed) ||
    parsed < options.min ||
    parsed > options.max
  ) {
    return defaultValue
  }

  return parsed
}

function getStrictBoundedIntegerEnv(
  name: string,
  defaultValue: number,
  options: {
    min: number
    max: number
  }
): number {
  const rawValue = optionalTrimmed(name)

  if (!/^\d+$/.test(rawValue)) {
    return defaultValue
  }

  return getBoundedIntegerEnv(name, defaultValue, options)
}

function getFreshStaleTtls(options: {
  fresh: { defaultValue: number; max: number; min: number; name: string }
  stale: { defaultValue: number; max: number; min: number; name: string }
}) {
  const freshTtlMs = getStrictBoundedIntegerEnv(
    options.fresh.name,
    options.fresh.defaultValue,
    options.fresh
  )
  const staleTtlMs = getStrictBoundedIntegerEnv(
    options.stale.name,
    options.stale.defaultValue,
    options.stale
  )

  if (freshTtlMs >= staleTtlMs) {
    return {
      freshTtlMs: options.fresh.defaultValue,
      staleTtlMs: options.stale.defaultValue,
    }
  }

  return { freshTtlMs, staleTtlMs }
}

function getPanelCacheTtls() {
  return getFreshStaleTtls({
    fresh: {
      defaultValue: DEFAULT_PANEL_CACHE_FRESH_TTL_MS,
      min: 1_000,
      max: 5 * 60_000,
      name: 'PANEL_CACHE_FRESH_TTL_MS',
    },
    stale: {
      defaultValue: DEFAULT_PANEL_CACHE_STALE_TTL_MS,
      min: 5_000,
      max: 15 * 60_000,
      name: 'PANEL_CACHE_STALE_TTL_MS',
    },
  })
}

function getStockQuoteCacheTtls() {
  return getFreshStaleTtls({
    fresh: {
      defaultValue: DEFAULT_STOCK_QUOTE_FRESH_TTL_MS,
      min: 1_000,
      max: 60_000,
      name: 'STOCK_QUOTE_FRESH_TTL_MS',
    },
    stale: {
      defaultValue: DEFAULT_STOCK_QUOTE_STALE_TTL_MS,
      min: 5_000,
      max: 10 * 60_000,
      name: 'STOCK_QUOTE_STALE_TTL_MS',
    },
  })
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

  get RATE_LIMIT_REDIS_TIMEOUT_MS() {
    return getStrictBoundedIntegerEnv(
      'RATE_LIMIT_REDIS_TIMEOUT_MS',
      DEFAULT_RATE_LIMIT_REDIS_TIMEOUT_MS,
      {
        min: MIN_RATE_LIMIT_REDIS_TIMEOUT_MS,
        max: MAX_RATE_LIMIT_REDIS_TIMEOUT_MS,
      }
    )
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

  get FAVORITES_QUOTE_CONCURRENCY() {
    return getBoundedIntegerEnv(
      'FAVORITES_QUOTE_CONCURRENCY',
      DEFAULT_FAVORITES_QUOTE_CONCURRENCY,
      {
        min: MIN_FAVORITES_QUOTE_CONCURRENCY,
        max: MAX_FAVORITES_QUOTE_CONCURRENCY,
      }
    )
  },

  get PANEL_CACHE_FRESH_TTL_MS() {
    return getPanelCacheTtls().freshTtlMs
  },

  get PANEL_CACHE_STALE_TTL_MS() {
    return getPanelCacheTtls().staleTtlMs
  },

  get STOCK_QUOTE_FRESH_TTL_MS() {
    return getStockQuoteCacheTtls().freshTtlMs
  },

  get STOCK_QUOTE_STALE_TTL_MS() {
    return getStockQuoteCacheTtls().staleTtlMs
  },

  get STOCK_QUOTE_NOT_FOUND_TTL_MS() {
    return getStrictBoundedIntegerEnv(
      'STOCK_QUOTE_NOT_FOUND_TTL_MS',
      DEFAULT_STOCK_QUOTE_NOT_FOUND_TTL_MS,
      {
        min: MIN_STOCK_QUOTE_NOT_FOUND_TTL_MS,
        max: MAX_STOCK_QUOTE_NOT_FOUND_TTL_MS,
      }
    )
  },
}
