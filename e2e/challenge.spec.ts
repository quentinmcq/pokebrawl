import { expect, test } from '@playwright/test'
import { openApp, skipToResult } from './helpers'

test.describe('Défi du jour', () => {
  test('compose une équipe, joue le combat et revient l’améliorer', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Jouer' }).click()
    await expect(page.getByRole('button', { name: 'Lancer le combat' })).toBeDisabled()
    await page.getByRole('button', { name: /Compléter/ }).click()
    await expect(page.locator('[data-role="budget-summary"]')).toHaveText(/^\d[\d ]* \/ 1 000 points · \d+ Pokémon/)
    await page.getByRole('button', { name: 'Lancer le combat' }).click()

    await expect(page).toHaveURL(/\?a=ids%3A.+&b=horde%3A/)
    await skipToResult(page)
    const end = page.locator('#end-actions')
    await expect(end).toBeVisible()
    await expect(end.locator('[data-role="result"]')).toHaveText(/Défi réussi|Raté/)
    await expect(end.locator('[data-role="report"] li').first()).toBeVisible()

    await end.getByRole('button', { name: 'Modifier mon équipe' }).click()
    await expect(page.getByRole('heading', { name: 'Catalogue' })).toBeVisible()
    await expect(page.locator('[data-role="team"] .chip').first()).toBeVisible()
  })

  test('une équipe hors budget ne peut pas combattre', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pokebrawl.team', JSON.stringify('ids:150*30')))
    await openApp(page)
    await page.getByRole('button', { name: 'Jouer' }).click()
    await expect(page.locator('[data-role="budget-summary"]')).toHaveText(/retire des Pokémon/)
    await expect(page.getByRole('button', { name: 'Lancer le combat' })).toBeDisabled()
  })
})
