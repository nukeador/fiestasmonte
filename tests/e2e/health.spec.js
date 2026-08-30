import { test, expect } from './fixtures.js';

test.use({ serviceWorkers: 'block' });

const routes = [
  ['/', '[data-fiestas-card]'],
  ['/mapa/', '[data-fiestas-map]'],
  ['/penas/', '[data-penas-app]'],
  ['/plan/', '[data-fiestas-plans-page]'],
  ['/plan/importar/', '[data-plan-import-title]'],
  ['/planes/', '[data-community-plans-page]'],
  ['/populares/', '[data-fiestas-popular-page]']
];

function assertClean(page, route) {
  expect(page.failedResponses, `${route} · respuestas fallidas: ${page.failedResponses.join(' | ')}`).toEqual([]);
  expect(page.consoleErrors, `${route} · errores de consola: ${page.consoleErrors.join(' | ')}`).toEqual([]);
}

for (const [route, marker] of routes) {
  test(`${route} carga sin errores`, async ({ page }) => {
    await page.goto(route);
    await page.locator(marker).first().waitFor({ state: 'attached' });
    assertClean(page, route);
  });
}

test('una ficha de actividad carga sin errores', async ({ page }) => {
  await page.goto('/');
  const urlPath = await page.evaluate(() => (window.__FIESTAS_2026_EVENTS__ || [])[0]?.urlPath || '');
  expect(urlPath).toBeTruthy();
  await page.goto(urlPath);
  await page.locator('[data-fiestas-detail]').waitFor({ state: 'attached' });
  assertClean(page, urlPath);
});
