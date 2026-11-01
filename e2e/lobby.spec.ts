import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test.describe('Accueil', () => {
  test('présente le défi du jour et mène au constructeur d’équipe', async ({ page }) => {
    await openApp(page)
    await expect(page.locator('[data-role="daily-title"]')).toHaveText(/^Défi du \d+(er)? \p{L}+$/u)
    await expect(page.locator('[data-role="daily-versus"]')).toHaveText(/^contre .+ · \d+ Pokémon$/)
    await expect(page.locator('[data-role="countdown"]')).toHaveText(/^Nouveau défi dans /)
    await page.getByRole('button', { name: 'Jouer' }).click()
    await expect(page.locator('[data-role="opponent-mode"]')).toHaveText('Défi du jour')
    await expect(page.getByRole('heading', { name: 'Catalogue' })).toBeVisible()
    await page.getByRole('button', { name: 'Retour' }).click()
    await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible()
  })

  test('replie le classement et les succès sous une ligne chacun', async ({ page }) => {
    await openApp(page)
    const ranking = page.locator('details.ranking')
    await expect(ranking.locator('[data-role="ranking-summary"]')).toHaveText(/joueur|Sois le premier/)
    await ranking.locator('summary').click()
    await expect(ranking.getByRole('button', { name: 'Hier' })).toBeVisible()
    await page.locator('details.achievements summary').click()
    await expect(page.locator('[data-role="badges"] li')).toHaveCount(15)
  })
})
