import { expect, test } from '@playwright/test'
import { openApp, showControls, skipToResult } from './helpers'

test.describe('Regarder un combat', () => {
  test('choisit les camps, lance le combat et le termine', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Regarder un combat' }).click()
    const menu = page.locator('#menu')
    await menu.getByLabel('Camp bleu').selectOption('gen2')
    await menu.getByLabel('Camp rouge').selectOption('type:water')
    await menu.locator('summary').click()
    await expect(menu.getByText('Le même numéro rejoue exactement le même combat')).toBeVisible()
    await menu.getByLabel('Combat n°').fill('42')
    await menu.getByRole('button', { name: 'Lancer le combat' }).click()

    await expect(page).toHaveURL(/a=gen2&b=type%3Awater&seed=42/)
    await expect(page).toHaveTitle('Gen 2 contre Type Eau · PokéBrawl')
    await skipToResult(page)
    await expect(page.getByRole('button', { name: 'Revoir le combat' })).toBeVisible()
  })

  test('range les actions rares dans un menu où chacune dit son nom', async ({ page }) => {
    await openApp(page, '/?a=ids:25*5&b=ids:129*5&seed=7')
    await showControls(page)
    await page.getByRole('button', { name: /Plus d.options/ }).click()
    const items = page.locator('.more-menu [role="menuitem"]:visible')
    await expect(items).toContainText(['Nouveau combat', 'Changer les équipes'])
  })

  test('se quitte à tout moment pour revenir à l’accueil', async ({ page }) => {
    await openApp(page, '/?a=ids:25*5&b=ids:129*5&seed=7')
    await showControls(page)
    await page.getByRole('button', { name: 'Quitter le combat' }).click()
    await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible()

    await openApp(page, '/?a=ids:25*5&b=ids:129*5&seed=7')
    await skipToResult(page)
    await page.getByRole('button', { name: 'Quitter le combat' }).click()
    await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible()
  })

  test('un lien vers une équipe inconnue ouvre l’accueil plutôt qu’une erreur', async ({ page }) => {
    await openApp(page, '/?a=foo&b=gen1')
    await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible()
  })
})
