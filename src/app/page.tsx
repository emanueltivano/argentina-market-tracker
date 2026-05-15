import Panel from '@/app/dashboard/components/Panel'
import {
  isMarketDataPanelKey,
  type MarketDataPanelKey,
} from '@/lib/market'
import { logServerError } from '@/lib/server/observability'
import { getOrCreatePanelResponse } from '@/lib/server/panelCache'

export const dynamic = 'force-dynamic'

type HomeProps = {
  searchParams?: Promise<{
    panel?: string
  }>
}

const DEFAULT_PANEL_KEY: MarketDataPanelKey = 'lider'
const INITIAL_PANEL_ERROR_MESSAGE = 'No se pudo cargar el panel de mercado.'

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedPanel = resolvedSearchParams.panel ?? null
  const initialPanelKey = isMarketDataPanelKey(requestedPanel)
    ? requestedPanel
    : DEFAULT_PANEL_KEY
  const shouldPrefetchInitialPanel =
    process.env.DISABLE_SERVER_DASHBOARD_PREFETCH !== '1'

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
    />
  )
}
