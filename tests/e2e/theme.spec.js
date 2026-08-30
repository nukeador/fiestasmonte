import { test, expect } from './fixtures.js';

test('el tema oscuro se conserva al navegar', async ({ page }) => {
  await page.goto('/');
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
  const before = await isDark();

  await page.locator('[data-menu-open]').first().click();
  await expect(page.locator('[data-menu-drawer]')).toBeVisible();
  await page.locator('[data-theme-toggle]').first().click();
  await expect.poll(isDark).toBe(!before);

  const stored = await page.evaluate(() => window.localStorage.getItem('fiestasMonte:theme'));
  expect(stored).toBe(before ? 'light' : 'dark');
  await page.goto('/mapa/');
  expect(await isDark()).toBe(!before);
});
