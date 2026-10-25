import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

const CHALLENGE = '/?defi=ids:25*3&de=Sacha&seed=42'

test.describe('Défi entre amis', () => {
  test('un lien reçu ouvre l’équipe à battre', async ({ page }) => {
    await openApp(page, CHALLENGE)
    await expect(page.locator('[data-role="opponent-mode"]')).toHaveText('Défi d’un ami')
    await expect(page.locator('[data-role="opponent-name"]')).toHaveText('Équipe de Sacha')
    await page.getByRole('button', { name: 'Retour' }).click()
    await expect(page.locator('[data-role="friend-title"]')).toHaveText('Équipe de Sacha')
  })

  test('l’aperçu du lien dans les messageries nomme l’ami', async ({ request }) => {
    const html = await (await request.get(CHALLENGE)).text()
    expect(html).toMatch(/<title[^>]*>Sacha te défie sur PokéBrawl<\/title>/)
    expect(html).toContain('Bats son équipe de 3 Pokémon')
  })

  test('un pseudo refusé est remplacé', async ({ request }) => {
    const html = await (await request.get('/?defi=ids:25&de=fdp&seed=1')).text()
    expect(html).toMatch(/<title[^>]*>Un ami te défie sur PokéBrawl<\/title>/)
  })
})
