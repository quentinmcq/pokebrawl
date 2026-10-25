import { expect, type Page } from '@playwright/test'

/** Opens a page of the app once it has started: the arena drawn and the lobby, a builder or a battle shown. */
export async function openApp(page: Page, path = '/') {
  await page.goto(path)
  await expect(page.locator('#stage canvas')).toBeAttached()
  await expect(page.locator('.loading')).toHaveCount(0)
}

/** Brings back the battle's control bar, which fades away while the battle plays. */
export async function showControls(page: Page) {
  await page.locator('#stage').click({ position: { x: 10, y: 10 } })
  await expect(page.locator('#controls')).not.toHaveClass(/is-idle/)
}

/** Ends the battle on screen at once, as the « Result » button does: the outcome is the one the battle would reach. */
export async function skipToResult(page: Page) {
  await showControls(page)
  await page.getByRole('button', { name: /Voir le résultat|Show the result/ }).click()
}
