import { test, expect } from './fixtures.js';

test('el mapa carga Leaflet bajo demanda y pinta marcadores', async ({ page }) => {
  await page.goto('/mapa/');

  await expect(page.locator('[data-fiestas-map]')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect.poll(
    () => page.locator('.leaflet-marker-icon, .leaflet-marker-pane > *').count(),
    { message: 'el mapa debe pintar al menos un marcador' }
  ).toBeGreaterThan(0);
  expect(await page.evaluate(() => typeof window.L)).toBe('object');

  const center = await page.evaluate(() => window.__FIESTAS_SITE__?.center || []);
  expect(center).toEqual([41.5090909, -4.4593002]);
});
