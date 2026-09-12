import test from 'node:test';
import assert from 'node:assert/strict';
import { getAgendaDate } from './agenda-date.js';

test('moves activities from midnight through 05:00 to the previous agenda day', () => {
  for (const startTime of ['00:00', '01:00', '02:30', '05:00']) {
    assert.equal(getAgendaDate('2026-09-12', startTime), '2026-09-11');
  }
});

test('keeps activities after 05:00 and without a valid time on their calendar day', () => {
  for (const startTime of ['05:01', '08:30', '', '25:00', '12:60']) {
    assert.equal(getAgendaDate('2026-09-12', startTime), '2026-09-12');
  }
});

test('moves overnight activities across month and year boundaries', () => {
  assert.equal(getAgendaDate('2026-10-01', '04:00'), '2026-09-30');
  assert.equal(getAgendaDate('2026-01-01', '00:00'), '2025-12-31');
});
