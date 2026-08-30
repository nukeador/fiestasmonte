import { test, expect } from './fixtures.js';

test('el service worker, manifest e iconos de la PWA son de Montemayor', async ({ page }) => {
  await page.goto('/');

  await expect.poll(
    () => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())),
    { message: 'el service worker debe registrarse', timeout: 15_000 }
  ).toBe(true);

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await page.request.get(href);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toContain('Fiestas 2026');
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.icons.map((icon) => icon.src).join(' ')).toContain('montemayordepililla');
});
