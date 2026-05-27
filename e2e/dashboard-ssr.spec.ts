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

    try {
      const response = await page.goto(`${baseURL}/`, {
        waitUntil: 'domcontentloaded',
      })

      expect(response).not.toBeNull()
      expect(response?.ok()).toBe(true)

      await expect(page.getByRole('heading', { name: 'Panel Líder' })).toBeVisible()
      await expect(page.getByText(/Última actualización:/)).toBeVisible()
      await expect(page.getByText('GGAL')).toBeVisible()

      const initialHtml = await page.content()

      expect(initialHtml).toContain('Panel Líder')
      expect(initialHtml).toContain('GGAL')
      expect(initialHtml).toContain('data-symbol="GGAL"')
      expect(initialHtml).not.toContain('Cargando datos...')
    } finally {
      await context.close()
    }
  })
})
