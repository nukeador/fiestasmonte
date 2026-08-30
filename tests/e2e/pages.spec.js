import { test, expect } from './fixtures.js';

test('populares renderiza los contadores simulados', async ({ page }) => {
  await page.goto('/populares/');
  await expect(page.locator('[data-fiestas-popular-page]')).toBeVisible();
  await expect.poll(() => page.locator('[data-fiestas-popular-list] [data-fiestas-card]').count()).toBe(2);
  await expect(page.locator('[data-fiestas-popular-list] .fiestas-save-count').first()).toHaveText('4');
});

test('el catálogo de planes vecinales renderiza y sus fichas abren', async ({ page }) => {
  await page.goto('/planes/');
  await expect(page.locator('[data-community-plans-page]')).toBeVisible();
  const firstPlan = page.locator('a[href^="/planes/"]').first();
  await expect(firstPlan).toBeVisible();
  await page.goto(await firstPlan.getAttribute('href'));
  await expect(page.locator('h1')).not.toBeEmpty();
});

test('mi plan y la confirmación de calendario funcionan', async ({ page }) => {
  await page.goto('/?view=agenda');
  const card = page.locator('[data-fiestas-card]').first();
  await expect(card).toBeVisible();
  await card.locator('[data-fiestas-save]').click();

  await page.goto('/plan/');
  await expect(page.locator('[data-fiestas-plans-page]')).toBeVisible();
  await expect(page.locator('[data-plan-saved-content]')).toContainText(/actividad guardada|actividades guardadas/);
  await page.locator('[data-plan-export-calendar="__saved__"]').click();
  await expect(page.locator('[data-plan-calendar-dialog]')).toBeVisible();
  await expect(page.locator('[data-plan-calendar-download]')).toBeVisible();
  await page.locator('.fiestas-plan-calendar-dialog-close[data-plan-calendar-close]').click();
  await expect(page.locator('[data-plan-calendar-dialog]')).toBeHidden();
});
