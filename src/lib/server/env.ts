import 'server-only'

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

export const ENV = {
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
}
