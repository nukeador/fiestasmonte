import { test, expect } from './fixtures.js';

const cards = '[data-fiestas-card]';

async function openSearchPanel(page) {
  const panel = page.locator('[data-fiestas-search-panel]');
  if (!(await panel.isVisible())) await page.locator('[data-fiestas-search-toggle]').first().click();
  await expect(panel).toBeVisible();
  return panel;
}

test.describe('agenda', () => {
  test('selecciona el día en curso al abrir la agenda', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator(cards).first()).toBeVisible();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    const todayCard = page.locator(`[data-date="${today}"]`);
    if (await todayCard.count()) {
      await expect(todayCard).toHaveAttribute('aria-pressed', 'true');
      await expect(todayCard).toHaveClass(/is-active/);
      await expect(page.locator('[data-date="all"]')).toHaveAttribute('aria-pressed', 'false');
    } else {
      await expect(page.locator('[data-date="all"]')).toHaveAttribute('aria-pressed', 'true');
    }
    expect(await page.locator(cards).count()).toBeGreaterThan(0);
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
    const initialOrder = await dates.evaluateAll((cards) => cards.map((card) => card.dataset.date));
    const allIndex = initialOrder.indexOf('all');
    expect(allIndex).toBeGreaterThan(0);
    expect(initialOrder[allIndex + 1]).toBe('2026-09-11');
    expect(initialOrder.slice(0, allIndex)).toEqual([...initialOrder.slice(0, allIndex)].sort().reverse());
    expect(initialOrder.slice(allIndex + 2)).toEqual([...initialOrder.slice(allIndex + 2)].sort());
    await expect(dates.nth(allIndex)).toHaveAttribute('data-date', 'all');
    await expect(dates.nth(allIndex + 1)).toHaveClass(/is-active/);
    await expect.poll(() => dates.locator('..').evaluate((strip) => strip.scrollLeft)).toBeGreaterThan(0);

    await page.locator('[data-fiestas-dates] [data-date="2026-09-12"]').click();
    await expect.poll(() => dates.evaluateAll((cards) => cards.map((card) => card.dataset.date))).toEqual(initialOrder);
    await expect(dates.nth(allIndex + 2)).toHaveClass(/is-active/);
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
