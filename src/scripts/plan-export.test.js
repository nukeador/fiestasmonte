import test from 'node:test';
import assert from 'node:assert/strict';

import { createCalendarLinks, createIcs, createIcsFile, createPlanImportUrl, createPlanJson, decodePlanImportHash } from './plan-export.js';

test('plan import URL encodes the same JSON used by file export', () => {
  globalThis.window = { location: { origin: 'https://fiestas.montemayordepililla.com' } };

  const plan = {
    name: 'Sábado con música',
    icon: 'music',
    activityIds: ['1', '30', '1']
  };

  const url = new URL(createPlanImportUrl(plan, '/plan/importar/'));
  const decoded = decodePlanImportHash(url.searchParams.get('hash'));
  const payload = JSON.parse(decoded);

  assert.equal(url.pathname, '/plan/importar/');
  assert.equal(decoded.at(-1), '\n');
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.festival, 'montemayor-2026');
  assert.equal(typeof payload.exportedAt, 'string');
  assert.deepEqual(payload.plans, JSON.parse(createPlanJson(plan)).plans);
});

const activity = {
  id: '19',
  date: '2026-09-04',
  startTime: '19:30',
  endTime: '21:00',
  title: 'Paella popular',
  location: 'Plaza Mayor',
  description: 'Paella popular para las fiestas.',
  canonicalUrl: 'https://fiestas.montemayordepililla.com/e/19/paella-popular/'
};

test('creates an ICS with local Montemayor times', () => {
  const ics = createIcs([activity], 'Plan de viernes');

  assert.match(ics, /PRODID:-\/\/Fiestas 2026\/\/Montemayor de Pililla\/\/ES/);
  assert.match(ics, /X-WR-CALNAME:Plan de viernes/);
  assert.match(ics, /DTSTART;TZID=Europe\/Madrid:20260904T193000/);
  assert.match(ics, /DTEND;TZID=Europe\/Madrid:20260904T210000/);
  assert.match(ics, /SUMMARY:Paella popular/);
});

test('keeps an activity that crosses midnight on the following date', () => {
  const ics = createIcs([{ ...activity, date: '2026-09-05', startTime: '22:15', endTime: '01:00' }]);

  assert.match(ics, /DTSTART;TZID=Europe\/Madrid:20260905T221500/);
  assert.match(ics, /DTEND;TZID=Europe\/Madrid:20260906T010000/);
});

test('creates direct Google Calendar and Outlook links for one activity', () => {
  const links = createCalendarLinks(activity, activity.canonicalUrl);
  const google = new URL(links.google);
  const outlook = new URL(links.outlook);

  assert.equal(google.hostname, 'calendar.google.com');
  assert.equal(google.searchParams.get('action'), 'TEMPLATE');
  assert.equal(google.searchParams.get('text'), activity.title);
  assert.equal(google.searchParams.get('dates'), '20260904T173000Z/20260904T190000Z');
  assert.equal(google.searchParams.get('location'), activity.location);
  assert.equal(outlook.hostname, 'outlook.live.com');
  assert.equal(outlook.pathname, '/calendar/deeplink/compose');
  assert.equal(outlook.searchParams.get('rru'), 'addevent');
  assert.equal(outlook.searchParams.get('startdt'), '2026-09-04T17:30:00.000Z');
  assert.equal(outlook.searchParams.get('enddt'), '2026-09-04T19:00:00.000Z');
});

test('names an activity ICS file after the activity title', () => {
  const file = createIcsFile([activity], activity.title);

  assert.equal(file.name, 'paella-popular.ics');
  assert.equal(file.type, 'text/calendar;charset=utf-8');
});
