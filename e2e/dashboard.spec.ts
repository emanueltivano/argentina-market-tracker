import { expect, type Page, test } from '@playwright/test'

type PanelKey = 'lider' | 'general' | 'cedears'

type PanelRequest = {
  type: string | null
  refresh: string | null
}

type HistoryRequest = {
  symbol: string
  range: string | null
  market: string | null
}

type MockPanelItem = {
  simbolo: string
  descripcion: string
  ultimoPrecio?: number
  variacionPorcentual?: number
  volumen?: number
}

type MockHistoryPoint = {
  date: string
  close: number
  open?: number
  high?: number
  low?: number
  volume?: number
}

const fetchedAt = '2026-05-04T16:00:00.000Z'

const panelData: Record<PanelKey, MockPanelItem[]> = {
  lider: [
    {
      simbolo: 'GGAL',
      descripcion: 'Grupo Financiero Galicia',
      ultimoPrecio: 4200.5,
      variacionPorcentual: 1.25,
      volumen: 120000,
    },
  ],
  general: [
    {
      simbolo: 'YPFD',
      descripcion: 'YPF',
      ultimoPrecio: 38000,
      variacionPorcentual: -0.75,
      volumen: 90000,
    },
  ],
  cedears: [
    {
      simbolo: 'AAPL',
      descripcion: 'Apple',
      ultimoPrecio: 15000,
      variacionPorcentual: 0.5,
      volumen: 70000,
    },
  ],
}

function panelResponse(data: MockPanelItem[], cacheStatus = 'fresh') {
  return {
    ok: true,
    data,
    fetchedAt,
    servedAt: fetchedAt,
    cacheStatus,
  }
}

function historySuccessResponse(
  symbol: string,
  range: string,
  data: MockHistoryPoint[],
  cacheStatus = 'fresh'
) {
  return {
    ok: true,
    data,
    fetchedAt,
    servedAt: fetchedAt,
    cacheStatus,
    range,
    market: 'bCBA',
    symbol,
  }
}

async function mockPanelApi(
  page: Page,
  options: {
    requests?: PanelRequest[]
    delayRefreshMs?: number
    error?: boolean
  } = {}
) {
  await page.route(/\/api\/panel(?:\?|$)/, async (route) => {
    const url = new URL(route.request().url())
    const type = url.searchParams.get('type') ?? 'lider'
    const refresh = url.searchParams.get('refresh')

    options.requests?.push({ type, refresh })

    if (options.error) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'PANEL_ERROR',
        }),
      })
      return
    }

    if (refresh === '1' && options.delayRefreshMs) {
      await new Promise((resolve) => {
        setTimeout(resolve, options.delayRefreshMs)
      })
    }

    const key = type === 'general' || type === 'cedears' ? type : 'lider'
    const data =
      refresh === '1'
        ? [
            {
              ...panelData[key][0],
              simbolo: `${panelData[key][0].simbolo}R`,
            },
          ]
        : panelData[key]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(panelResponse(data)),
    })
  })
}

async function mockHistoryApi(
  page: Page,
  options: {
    requests?: HistoryRequest[]
    responsesByRange?: Partial<
      Record<'1W' | '1M' | '3M' | '6M' | '1Y', MockHistoryPoint[]>
    >
    errorRanges?: string[]
  } = {}
) {
  await page.route(/\/api\/stocks\/[^/]+\/history\?/, async (route) => {
    const url = new URL(route.request().url())
    const pathMatch = url.pathname.match(/\/api\/stocks\/([^/]+)\/history$/)
    const symbol = pathMatch ? decodeURIComponent(pathMatch[1] ?? '') : ''
    const range = url.searchParams.get('range')
    const market = url.searchParams.get('market')

    options.requests?.push({ symbol: symbol.toUpperCase(), range, market })

    if (range && options.errorRanges?.includes(range)) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'HISTORY_ERROR',
        }),
      })
      return
    }

    const data = range
      ? (options.responsesByRange?.[
          range as keyof NonNullable<typeof options.responsesByRange>
        ] ?? [])
      : []

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        historySuccessResponse(symbol.toUpperCase(), range ?? '1M', data)
      ),
    })
  })
}

async function selectMarketPanel(page: Page, label: string) {
  const panelButton = page.getByRole('button', {
    name: `Mostrar panel ${label}`,
  })

  if (await panelButton.isVisible().catch(() => false)) {
    await panelButton.click()
    return
  }

  await page
    .getByRole('button', { name: 'Abrir navegación de paneles' })
    .click()
  await panelButton.click()
}

test.describe('dashboard', () => {
  test('loads the initial panel with mocked market data and freshness metadata', async ({
    page,
  }) => {
    await mockPanelApi(page)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Panel Líder' })).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).toBeVisible()
    await expect(page.getByText(/Última actualización:/)).toBeVisible()
  })

  test('switches panels and requests the selected panel type', async ({ page }) => {
    const requests: PanelRequest[] = []

    await mockPanelApi(page, { requests })
    await page.goto('/')

    await selectMarketPanel(page, 'Panel General')
    await expect(page.getByRole('heading', { name: 'Panel General' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Abrir detalle de YPFD, YPF' })
    ).toBeVisible()

    await selectMarketPanel(page, 'CEDEARs')
    await expect(page.getByRole('heading', { name: 'CEDEARs' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Abrir detalle de AAPL, Apple' })
    ).toBeVisible()

    await expect
      .poll(() => requests.map((request) => request.type))
      .toEqual(expect.arrayContaining(['lider', 'general', 'cedears']))
  })

  test('refreshes manually with cache bypass and updates the rows', async ({
    page,
  }) => {
    const requests: PanelRequest[] = []

    await mockPanelApi(page, { requests, delayRefreshMs: 300 })
    await page.goto('/')

    await expect(
      page.getByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Actualizar' }).click()

    await expect
      .poll(() => requests.some((request) => request.refresh === '1'))
      .toBe(true)
    await expect(
      page.getByRole('button', {
        name: 'Abrir detalle de GGALR, Grupo Financiero Galicia',
      })
    ).toBeVisible()
  })

  test('renders API errors and keeps manual refresh available', async ({ page }) => {
    await mockPanelApi(page, { error: true })

    await page.goto('/')

    const errorMessage = page.getByText(
      'Error cargando datos: No se pudo cargar el panel de mercado.'
    )

    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toHaveText(
      'Error cargando datos: No se pudo cargar el panel de mercado.'
    )
    await expect(page.getByRole('button', { name: 'Actualizar' })).toBeVisible()
  })

  test('opens and closes the stock details modal while restoring focus', async ({
    page,
  }) => {
    await mockPanelApi(page)
    await mockHistoryApi(page)
    await page.goto('/')

    const opener = page.getByRole('button', {
      name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
    })

    await opener.click()

    const dialog = page.getByRole('dialog', { name: 'GGAL' })

    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Grupo Financiero Galicia')).toBeVisible()
    await expect(dialog.getByText('Último precio')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('mobile opens stock details when responsive columns are hidden', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'Responsive hidden-column coverage is mobile-specific.'
    )

    await mockPanelApi(page)
    await mockHistoryApi(page)
    await page.goto('/')

    await page
      .getByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
      .click()

    const dialog = page.getByRole('dialog', { name: 'GGAL' })

    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Cantidad compra')).toBeVisible()
    await expect(dialog.getByText('Volumen')).toBeVisible()
  })

  test('loads stock history in the modal and changes range with the expected request', async ({
    page,
  }) => {
    const historyRequests: HistoryRequest[] = []

    await mockPanelApi(page)
    await mockHistoryApi(page, {
      requests: historyRequests,
      responsesByRange: {
        '1M': [
          { date: '2026-04-13', close: 3900 },
          { date: '2026-04-21', close: 3960 },
          { date: '2026-05-01', close: 4165 },
        ],
        '1W': [
          { date: '2026-05-01', close: 4100 },
          { date: '2026-05-05', close: 4140 },
          { date: '2026-05-07', close: 4165 },
        ],
      },
    })
    await page.goto('/')

    const opener = page.getByRole('button', {
      name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
    })

    await opener.click()

    const dialog = page.getByRole('dialog', { name: 'GGAL' })

    await expect(dialog).toBeVisible()
    await expect
      .poll(() => historyRequests.map((request) => request.range))
      .toContain('1M')
    await expect(dialog.getByText('Último mes')).toBeVisible()
    await expect(dialog.getByText(/\+\s*6,79%/)).toBeVisible()
    await expect(
      dialog.getByRole('img', { name: 'Evolución del precio de cierre de GGAL' })
    ).toBeVisible()
    await expect(dialog.getByText('$ 3.900')).toBeVisible()
    await expect(dialog.getByText('$ 4.165')).toBeVisible()

    await dialog.getByRole('button', { name: '1W' }).click()

    await expect
      .poll(() =>
        historyRequests.some(
          (request) =>
            request.symbol === 'GGAL' &&
            request.range === '1W' &&
            request.market === 'bCBA'
        )
      )
      .toBe(true)
    await expect(dialog.getByText('Última semana')).toBeVisible()
    await expect(dialog.getByText(/\+\s*1,59%/)).toBeVisible()
    await expect(dialog.getByText('$ 4.100')).toBeVisible()
    await expect(dialog.getByText('$ 4.165')).toBeVisible()

    await dialog.getByRole('button', { name: 'Cerrar detalle' }).click()

    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('renders an error state when stock history fails', async ({ page }) => {
    await mockPanelApi(page)
    await mockHistoryApi(page, {
      errorRanges: ['1M'],
    })
    await page.goto('/')

    await page
      .getByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
      .click()

    const dialog = page.getByRole('dialog', { name: 'GGAL' })

    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('alert').getByText('No se pudo cargar el histórico.')
    ).toBeVisible()
  })

  test('renders an empty state when stock history has no points', async ({ page }) => {
    await mockPanelApi(page)
    await mockHistoryApi(page, {
      responsesByRange: {
        '1M': [],
      },
    })
    await page.goto('/')

    await page
      .getByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
      .click()

    const dialog = page.getByRole('dialog', { name: 'GGAL' })

    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Sin histórico disponible')).toBeVisible()
    await expect(
      dialog.getByText('No hay datos históricos para este rango.')
    ).toBeVisible()
  })
})
