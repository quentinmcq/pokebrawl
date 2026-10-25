import { expect, test } from '@playwright/test'

test.describe('Pages « qui gagne ? »', () => {
  test('l’index montre les générations en tableau et mène aux affiches', async ({ page }) => {
    await page.goto('/combats/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qui gagne ?')
    await expect(page.locator('.share-table').first().locator('td a')).toHaveCount(72)
    await page.locator('.share-table a[href="/combats/gen-1-contre-gen-3/"]').first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gen 1 contre Gen 3 : qui gagne ?')
    await expect(page.getByRole('link', { name: 'Regarder un combat' })).toHaveAttribute(
      'href',
      /^\/\?a=gen1&b=gen3&seed=\d+$/,
    )
  })

  test('chaque affiche a sa traduction et son sitemap', async ({ page, request }) => {
    await page.goto('/en/battles/gen-1-vs-gen-3/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gen 1 vs Gen 3: who wins?')
    await expect(page.locator('link[hreflang="fr"]')).toHaveAttribute('href', /\/combats\/gen-1-contre-gen-3\/$/)
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap.match(/<url>/g)).toHaveLength(400)
  })

  test('une adresse inconnue répond 404', async ({ request }) => {
    const response = await request.get('/combats/nimporte-quoi/')
    expect(response.status()).toBe(404)
    expect(await response.text()).toContain('Page introuvable')
  })

  test('le site envoie ses en-têtes de sécurité', async ({ request }) => {
    const headers = (await request.get('/')).headers()
    expect(headers['content-security-policy']).toContain("script-src 'self'")
    expect(headers['x-content-type-options']).toBe('nosniff')
  })
})
