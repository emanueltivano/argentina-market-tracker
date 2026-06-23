import { expect, test } from '@playwright/test'

test.describe('dashboard SSR boot', () => {
  test.use({ javaScriptEnabled: false })

  test('@ssr-boot server-renders the initial dashboard panel before hydration', async ({
    page,
    request,
    baseURL,
  }) => {
    test.skip(
      process.env.PLAYWRIGHT_E2E_MODE !== 'ssr',
      'SSR boot coverage runs only in the dedicated fixture-backed mode.'
    )

    const appUrl = baseURL ?? 'http://127.0.0.1:3100'
    const response = await request.get('/')

    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('text/html')

    const initialHtml = await response.text()

    expect(initialHtml).toContain('Panel Líder')
    expect(initialHtml).toContain('GGAL')
    expect(initialHtml).toContain('data-symbol="GGAL"')
    expect(initialHtml).toContain('Demo data')
    expect(initialHtml).not.toContain('Cargando datos...')

    const browserResponse = await page.goto(appUrl)

    expect(browserResponse).not.toBeNull()
    expect(browserResponse?.ok()).toBe(true)

    await expect(page.getByRole('heading', { name: 'Panel Líder' })).toBeVisible()
    await expect(page.getByLabel('Demo data badge')).toBeVisible()
    await expect(page.getByText(/Actualizado/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Actualizar' })).toHaveCount(0)
    await expect(page.getByRole('button', {
      name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
    })).toBeVisible()
  })
})
