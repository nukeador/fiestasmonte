import { test, expect } from './fixtures.js';

test.describe('navegación móvil', () => {
  test.skip(({ isMobile }) => !isMobile, 'solo aplica al proyecto móvil');

  test('el menú lateral abre y se cierra con Escape', async ({ page }) => {
    await page.goto('/');
    const drawer = page.locator('[data-menu-drawer]');
    await expect(drawer).toBeHidden();
    await page.locator('[data-menu-open]').first().click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('el panel de filtros abre y se cierra', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('[data-fiestas-search-panel]');
    await page.locator('[data-fiestas-search-toggle]').first().click();
    await expect(panel).toBeVisible();
    await page.locator('[data-fiestas-search-toggle]').first().click();
    await expect(panel).toBeHidden();
  });
});
