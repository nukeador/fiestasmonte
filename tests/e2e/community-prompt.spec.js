import { test, expect } from './fixtures.js';

test('el prompt comunitario usa los canales de Montemayor', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-fiestas-save]:visible').first().click();

  const prompt = page.locator('[data-community-prompt]');
  await expect(prompt).toBeVisible();
  await expect(prompt.locator('[data-community-prompt-channel="chat"]')).toHaveAttribute('href', 'https://t.me/montemayordepililla_chat');
  await expect(prompt.locator('[data-community-prompt-channel="website"]')).toHaveAttribute('href', 'https://www.montemayordepililla.com/');
  await expect(prompt.locator('[data-community-prompt-channel="bluesky"]')).toHaveAttribute('href', 'https://bsky.app/profile/montemayordepililla.com');
  await expect(prompt).not.toContainText(/Aldea|Pucela|Valladolid/);
});
