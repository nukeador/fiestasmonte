import { test, expect } from './fixtures.js';

const cards = '[data-fiestas-card]';

async function openSearchPanel(page) {
  const panel = page.locator('[data-fiestas-search-panel]');
  if (!(await panel.isVisible())) await page.locator('[data-fiestas-search-toggle]').first().click();
  await expect(panel).toBeVisible();
  return panel;
}

test.describe('agenda', () => {
  test('renderiza todas las actividades antes del inicio de fiestas', async ({ page }) => {
    await page.goto('/?date=all');

    await expect(page.locator(cards).first()).toBeVisible();
    await expect(page.locator('[data-date="all"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator(cards).count()).toBe(72);
  });

  test('el selector de fechas filtra el listado', async ({ page }) => {
    await page.goto('/');
    const total = await page.locator(cards).count();
    const days = page.locator('[data-fiestas-dates] [data-date]:not([data-date="all"])');
    await expect(days.first()).toBeVisible();
    await page.locator('[data-fiestas-dates] [data-date]:not([data-date="all"]):not(.is-active)').first().click();

    await expect.poll(() => page.locator(cards).count()).toBeLessThan(total);
    expect(await page.locator(cards).count()).toBeGreaterThan(0);
    await expect(page.locator('.fiestas-day-title')).toHaveCount(1);
  });

  test('muestra Todos antes del día inicial y no reordena al cambiar de día', async ({ page }) => {
    await page.goto('/?date=2026-09-11');

    const dates = page.locator('[data-fiestas-dates] [data-date]');
    const initialOrder = [
      '2026-09-10',
      '2026-09-09',
      '2026-09-08',
      '2026-09-07',
      '2026-09-06',
      '2026-09-05',
      '2026-09-04',
      'all',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13'
    ];
    await expect.poll(() => dates.evaluateAll((cards) => cards.map((card) => card.dataset.date))).toEqual(initialOrder);
    await expect(dates.nth(7)).toHaveAttribute('data-date', 'all');
    await expect(dates.nth(8)).toHaveAttribute('data-date', '2026-09-11');
    await expect(dates.nth(8)).toHaveClass(/is-active/);
    await expect.poll(() => dates.locator('..').evaluate((strip) => strip.scrollLeft)).toBeGreaterThan(0);

    await page.locator('[data-fiestas-dates] [data-date="2026-09-12"]').click();
    await expect.poll(() => dates.evaluateAll((cards) => cards.map((card) => card.dataset.date))).toEqual(initialOrder);
    await expect(dates.nth(9)).toHaveClass(/is-active/);
  });

  test('la búsqueda y los filtros por tipo se pueden limpiar', async ({ page }) => {
    await page.goto('/');
    const total = await page.locator(cards).count();
    await openSearchPanel(page);

    const title = await page.locator('.fiestas-event-title').first().textContent();
    const term = title.trim().split(/\s+/).find((word) => word.length > 4) || title.trim();
    await page.locator('[data-fiestas-search]').fill(term);
    await expect.poll(() => page.locator(cards).count()).toBeLessThan(total);
    expect(await page.locator(cards).count()).toBeGreaterThan(0);

    await page.locator('[data-fiestas-clear-filters]').click();
    await expect.poll(() => page.locator(cards).count()).toBe(total);

    await page.locator('[data-fiestas-types-toggle]').click();
    const option = page.locator('[data-fiestas-types] input[type="checkbox"]').first();
    await expect(option).toBeVisible();
    await option.check();
    await expect.poll(() => page.locator(cards).count()).toBeLessThan(total);
    await page.locator('[data-fiestas-types] [data-fiestas-filter-accept]').click();
    await page.locator('[data-fiestas-clear-filters]').click();
    await expect.poll(() => page.locator(cards).count()).toBe(total);
  });

  test('el botón Solo fiestas alterna el filtro', async ({ page }) => {
    await page.goto('/');
    const total = await page.locator(cards).count();
    const toggle = page.locator('[data-fiestas-fiestas-toggle]');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.locator(cards).count()).toBeLessThan(total);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => page.locator(cards).count()).toBe(total);
  });
});
