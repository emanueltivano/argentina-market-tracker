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
  API_URL: normalizeBaseUrl(required('API_URL')),

  TOKEN_ENDPOINT: normalizePath(process.env.TOKEN_ENDPOINT ?? 'token'),

  API_USERNAME: required('API_USERNAME'),
  API_PASSWORD: required('API_PASSWORD'),

  PANEL_LIDER_ENDPOINT: normalizePath(required('PANEL_LIDER_ENDPOINT')),
  PANEL_GENERAL_ENDPOINT: normalizePath(required('PANEL_GENERAL_ENDPOINT')),
  PANEL_CEDEARS_ENDPOINT: normalizePath(required('PANEL_CEDEARS_ENDPOINT')),

  NODE_ENV: process.env.NODE_ENV ?? 'development',
}