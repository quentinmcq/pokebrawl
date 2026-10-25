import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test.describe('Entraînement et catalogue', () => {
  test('choisit l’adversaire et la difficulté, sans titre en double', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: /Entraînement/ }).click()
    await expect(page.locator('[data-role="opponent-mode"]')).toHaveText('Entraînement')
    await expect(page.locator('[data-role="opponent-name"]')).toBeHidden()
    await page.getByLabel('Adversaire à battre').selectOption('type:fire')
    await page.getByRole('button', { name: 'Difficile' }).click()
    await expect(page.getByRole('button', { name: 'Difficile' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-role="horde-summary"]')).toHaveText(/1\s2\d\d points/)
  })

  test('filtre le catalogue par type efficace, puis réinitialise les filtres', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Jouer' }).click()
    const cards = page.locator('[data-role="cards"] .card')
    const everyone = await cards.count()
    const suggested = page.locator('[data-role="suggested"] .type-chip').first()
    await suggested.click()
    await expect(suggested).toHaveAttribute('aria-pressed', 'true')
    expect(await cards.count()).toBeLessThan(everyone)
    await expect(page.locator('[data-role="filter-count"]')).toHaveText('1')

    await page.locator('.filter-menu summary').click()
    await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click()
    await expect(cards).toHaveCount(everyone)
    await expect(page.locator('[data-role="filter-count"]')).toBeHidden()
  })

  test('recherche un Pokémon par son nom français ou anglais', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Jouer' }).click()
    await page.getByLabel('Rechercher un Pokémon').fill('dracaufeu')
    await expect(page.locator('[data-role="cards"] .card-name')).toHaveText(['Dracaufeu'])
    await page.getByLabel('Rechercher un Pokémon').fill('charizard')
    await expect(page.locator('[data-role="cards"] .card-name')).toHaveText(['Dracaufeu'])
  })
})
