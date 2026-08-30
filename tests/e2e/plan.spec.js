import { test, expect } from './fixtures.js';

const FAVORITES_KEY = 'fiestasMonte:favorites';

function planHash(activityIds) {
  const payload = {
    schemaVersion: 1,
    festival: 'montemayor-2026',
    exportedAt: new Date('2026-08-01T10:00:00Z').toISOString(),
    plans: [{ name: 'Plan E2E Montemayor', icon: 'layers', activityIds }]
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

test('guardar una actividad persiste al recargar', async ({ page }) => {
  await page.goto('/?view=agenda');
  const card = page.locator('[data-fiestas-card]').first();
  const activityId = await card.getAttribute('data-fiestas-card');
  await card.locator('[data-fiestas-save]').click();

  await expect.poll(async () => {
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), FAVORITES_KEY);
    return JSON.parse(raw || '[]');
  }).toContain(activityId);

  await page.reload();
  await expect(page.locator(`[data-fiestas-card="${activityId}"] [aria-pressed="true"]`)).toHaveCount(1);
  await page.locator(`[data-fiestas-card="${activityId}"] [aria-pressed="true"]`).click();
  await expect.poll(async () => {
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), FAVORITES_KEY);
    return JSON.parse(raw || '[]');
  }).not.toContain(activityId);
});

test('importar un plan válido lo previsualiza y lo guarda', async ({ page }) => {
  await page.goto('/');
  const ids = await page.evaluate(() => (window.__FIESTAS_2026_EVENTS__ || []).slice(0, 3).map((event) => String(event.id)));
  await page.goto(`/plan/importar/?hash=${encodeURIComponent(planHash(ids))}`);

  await expect(page.locator('[data-plan-import-shared-preview]')).toBeVisible();
  await expect(page.locator('[data-plan-import-status]')).not.toContainText(/no es válido/i);
  await page.locator('[data-plan-import-shared-add]').click();
  await expect(page.locator('[data-plan-import-status]')).toContainText(/añadido a Mi plan/i);

  const plans = await page.evaluate(() => JSON.parse(window.localStorage.getItem('fiestasMonte:plans') || '{}'));
  expect(plans.plans?.length).toBeGreaterThan(0);
});

test('un hash corrupto muestra un error controlado', async ({ page }) => {
  await page.goto('/plan/importar/?hash=esto-no-es-base64-valido%21%21');
  await expect(page.locator('[data-plan-import-status]')).toContainText(/no es válido|no contiene/i);
  await expect(page.locator('[data-plan-import-title]')).toBeVisible();
  await expect(page.locator('[data-plan-import-shared-preview]')).toBeHidden();
});
