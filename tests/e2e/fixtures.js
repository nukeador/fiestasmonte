import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const leafletDist = path.join(root, 'node_modules', 'leaflet', 'dist');
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]']);
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const CORS = { 'access-control-allow-origin': '*' };

function leafletBody(pathname) {
  const file = pathname.endsWith('.css') ? 'leaflet.css' : 'leaflet.js';
  return {
    body: fs.readFileSync(path.join(leafletDist, file)),
    contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'
  };
}

function json(value) {
  return {
    status: 200,
    contentType: 'application/json; charset=utf-8',
    headers: CORS,
    body: JSON.stringify(value)
  };
}

function stubFor(url) {
  const { hostname, pathname } = url;

  if (hostname === 'unpkg.com' && /leaflet\.(js|css)$/.test(pathname)) {
    const { body, contentType } = leafletBody(pathname);
    return { status: 200, contentType, headers: CORS, body };
  }

  if (hostname === 'stats.nukeador.com') {
    if (pathname.endsWith('/matomo.js')) return { status: 200, contentType: 'text/javascript', headers: CORS, body: 'window._paq = window._paq || [];' };
    if (pathname.endsWith('/matomo.php')) return { status: 204, headers: CORS, body: '' };
  }

  if (hostname === 'api.montemayordepililla.com') {
    if (pathname === '/fiestas/saves') {
      return json({ ok: true, activities: [{ id: '1', saveCount: 4 }, { id: '19', saveCount: 3 }], totalSaves: 7 });
    }
    if (pathname === '/fiestas/plan-adds') {
      return json({ ok: true, plans: [{ id: 'fiestas-con-peques', addCount: 2 }], totalAdds: 2 });
    }
  }

  if (hostname === 'cdnjs.cloudflare.com') {
    return { status: 200, contentType: 'text/css; charset=utf-8', headers: CORS, body: '' };
  }

  if (hostname.endsWith('.basemaps.cartocdn.com')) {
    return { status: 200, contentType: 'image/png', headers: CORS, body: PIXEL_PNG };
  }

  if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(pathname)) {
    return { status: 200, contentType: 'image/png', headers: CORS, body: PIXEL_PNG };
  }

  return null;
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const blocked = [];
    const consoleErrors = [];
    const failedResponses = [];

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('response', (response) => {
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });

    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (LOCAL_HOSTNAMES.has(url.hostname)) return route.continue();

      const stub = stubFor(url);
      if (stub) return route.fulfill(stub);

      blocked.push(url.href);
      return route.abort();
    });

    page.consoleErrors = consoleErrors;
    page.failedResponses = failedResponses;
    await use(page);

    expect(blocked, `La suite no debe llamar a dominios externos sin simular: ${blocked.join(', ')}`).toEqual([]);
  }
});

export { expect };
