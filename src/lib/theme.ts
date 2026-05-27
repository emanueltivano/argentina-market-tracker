export const THEME_STORAGE_KEY = 'argentina-market-tracker:theme'
export const THEME_COOKIE_NAME = 'argentina-market-tracker-theme'
export const THEME_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365
export const THEME_CHANGE_EVENT = 'argentina-market-tracker:theme-change'

export type Theme = 'light' | 'dark'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}
