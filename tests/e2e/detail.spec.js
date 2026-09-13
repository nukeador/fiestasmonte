import { test, expect } from './fixtures.js';

async function detailPathWithCoordinates(page) {
  await page.goto('/');
  const urlPath = await page.evaluate(() => {
    const events = window.__FIESTAS_2026_EVENTS__ || [];
    return (events.find((event) => event.coordinates) || {}).urlPath || '';
  });
  expect(urlPath, 'debe existir una actividad con coordenadas').toBeTruthy();
  return urlPath;
}

test('la ficha muestra información, mapa y opciones de calendario', async ({ page }) => {
  const path = await detailPathWithCoordinates(page);
  await page.goto(path);

  const detail = page.locator('[data-fiestas-detail]');
  await expect(detail).toBeVisible();
  await expect(page.locator('h1')).not.toBeEmpty();
  await expect(detail).toHaveAttribute('data-event-start-time', /\d{2}:\d{2}/);
  await expect(page.locator('.fiestas-detail-facts')).not.toBeEmpty();
  await expect(page.locator('[data-fiestas-detail-map]')).toBeVisible();

  await page.locator('[data-fiestas-detail-action-calendar]').click();
  await expect(page.locator('[data-fiestas-detail-calendar-modal]')).toBeVisible();
  await expect(page.locator('[data-fiestas-detail-calendar-ics]')).toHaveAttribute('download', /\.ics$/);
  await expect(page.locator('[data-fiestas-detail-calendar-google]')).toHaveAttribute('href', /calendar\.google\.com/);
  await expect(page.locator('[data-fiestas-detail-calendar-outlook]')).toHaveAttribute('href', /outlook\.live\.com/);

  await page.locator('.calendar-modal-close[data-fiestas-detail-calendar-close]').click();
  await expect(page.locator('[data-fiestas-detail-calendar-modal]')).toBeHidden();
});

test('el concierto de Aarón Miguel señala la Peña Skpa-2', async ({ page }) => {
  await page.goto('/');
  const path = await page.evaluate(() => {
    const event = (window.__FIESTAS_2026_EVENTS__ || []).find((item) => String(item.id) === '45');
    return event?.urlPath || '';
  });
  expect(path).toBeTruthy();

  await page.goto(path);
  await expect(page.locator('[data-fiestas-detail]')).toHaveAttribute('data-event-location', 'Peña Skpa-2');
  await expect(page.locator('[data-fiestas-detail-map]')).toHaveAttribute('data-title', 'Peña Skpa-2');
  await expect(page.locator('.fiestas-detail-facts')).toContainText('15:30');
});
