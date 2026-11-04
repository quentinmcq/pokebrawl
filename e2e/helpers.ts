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
  // The bar fades again 2.5 s after a touch: on a busy machine it can be gone before the click, so both are retried.
  // A battle that ended on its own meanwhile shows the same result: its replay button, or a challenge's next steps.
  await expect(async () => {
    const over =
      (await page.getByRole('button', { name: /Revoir le combat|Watch the battle again/ }).isVisible()) ||
      (await page.locator('#end-actions').isVisible())
    if (over) return
    await showControls(page)
    await page.getByRole('button', { name: /Voir le résultat|Show the result/ }).click({ timeout: 1000 })
  }).toPass()
}
