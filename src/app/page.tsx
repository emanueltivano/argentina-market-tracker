import Panel from '@/features/dashboard/panel/Panel'
import { cookies } from 'next/headers'
import {
  isMarketDataPanelKey,
  type MarketDataPanelKey,
} from '@/lib/market'
import { ENV } from '@/lib/server/core/env'
import { logServerError } from '@/lib/server/core/observability'
import { getOrCreatePanelResponse } from '@/lib/server/panel/panelCache'
import { isTheme, type Theme, THEME_COOKIE_NAME } from '@/lib/theme'

export const dynamic = 'force-dynamic'

type HomeProps = {
  searchParams?: Promise<{
    panel?: string
  }>
}

const DEFAULT_PANEL_KEY: MarketDataPanelKey = 'lider'
const INITIAL_PANEL_ERROR_MESSAGE = 'No se pudo cargar el panel de mercado.'

export default async function Home({ searchParams }: HomeProps) {
  const cookieStore = await cookies()
  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedPanel = resolvedSearchParams.panel ?? null
  const initialPanelKey = isMarketDataPanelKey(requestedPanel)
    ? requestedPanel
    : DEFAULT_PANEL_KEY
  const shouldPrefetchInitialPanel =
    process.env.DISABLE_SERVER_DASHBOARD_PREFETCH !== '1'
  const storedTheme = cookieStore.get(THEME_COOKIE_NAME)?.value
  const initialTheme: Theme | undefined = isTheme(storedTheme)
    ? storedTheme
    : undefined

  let initialData
  let initialErrorMessage: string | undefined

  if (shouldPrefetchInitialPanel) {
    try {
      initialData = await getOrCreatePanelResponse(initialPanelKey, false)
    } catch (error: unknown) {
      logServerError('app.home.prefetch', error, {
        route: '/',
        panelKey: initialPanelKey,
      })
      initialErrorMessage = INITIAL_PANEL_ERROR_MESSAGE
    }
  }

  return (
    <Panel
      defaultPanel={DEFAULT_PANEL_KEY}
      initialData={initialData}
      initialErrorMessage={initialErrorMessage}
      initialPanelKey={initialPanelKey}
      initialTheme={initialTheme}
      isDemoMode={ENV.MARKET_DATA_SOURCE === 'demo'}
    />
  )
}
