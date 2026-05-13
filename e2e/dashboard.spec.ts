import { expect, type Page, test } from '@playwright/test'

type PanelKey = 'lider' | 'general' | 'cedears'

type PanelRequest = {
  type: string | null
  refresh: string | null
}

type MockPanelItem = {
  simbolo: string
  descripcion: string
  ultimoPrecio?: number
  variacionPorcentual?: number
  volumen?: number
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
})
