import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test.describe('English version', () => {
  test('speaks English under /en/, and links back to French', async ({ page }) => {
    await openApp(page, '/en/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page).toHaveTitle('PokéBrawl · Mass Pokémon battles')
    await expect(page.locator('[data-role="daily-title"]')).toHaveText(/challenge$/)
    await expect(page.getByRole('link', { name: 'Français' })).toHaveAttribute('href', '/')
    await page.getByRole('button', { name: 'Play' }).click()
    await page.getByLabel('Search for a Pokémon').fill('charizard')
    await expect(page.locator('[data-role="cards"] .card-name')).toHaveText(['Charizard'])
  })

  test('the server writes the English page for search engines', async ({ request }) => {
    const html = await (await request.get('/en/')).text()
    expect(html).toContain('<html lang="en"')
    expect(html).toContain('hreflang="fr"')
    expect(html).toContain('Loading the arena…')
  })
})
