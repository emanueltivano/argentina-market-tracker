import { expect, test } from '@playwright/test'

test.describe('dashboard SSR boot', () => {
  test('@ssr-boot server-renders the initial dashboard panel before hydration', async ({
    browser,
    baseURL,
  }) => {
    test.skip(
      process.env.PLAYWRIGHT_E2E_MODE !== 'ssr',
      'SSR boot coverage runs only in the dedicated fixture-backed mode.'
    )

    const context = await browser.newContext({
      javaScriptEnabled: false,
    })
    const page = await context.newPage()

    await page.goto(`${baseURL}/`)

    await expect(page.getByRole('heading', { name: 'Panel Líder' })).toBeVisible()
    await expect(page.getByText(/Última actualización:/)).toBeVisible()
    await expect(page.getByText('GGAL')).toBeVisible()

    const html = await page.content()

    expect(html).toContain('GGAL')
    expect(html).toContain('data-symbol="GGAL"')
    expect(html).not.toContain('Cargando datos...')

    await context.close()
  })
})
