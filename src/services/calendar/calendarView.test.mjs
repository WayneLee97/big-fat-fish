import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, weekStart, periodDays, movePeriod, needsManualReminder } from './calendarView.ts';

const now = new Date(2026, 10, 15, 12); // Sunday: week ends at the next local midnight.
const task = { id: 'manual', kind: 'normal', status: 'active', completed: false, eventDate: '2026-11-09', recurrenceRule: null, recurrenceGroupId: null, createdAt: 0 };
test('weeks start on Monday and use scheduled dates, not creation dates', () => {
  assert.equal(dateKey(weekStart(now)), '2026-11-09');
  assert.equal(needsManualReminder(task, now), true);
  assert.equal(needsManualReminder({ ...task, eventDate: '2026-11-15' }, now), true);
  for (const eventDate of ['2026-11-08', '2026-11-16']) assert.equal(needsManualReminder({ ...task, eventDate }, now), false);
});
test('completed, cancelled, imported and generated tasks have no red dot', () => {
  for (const patch of [{ completed: true }, { status: 'cancelled' }, { id: 'ai-123' }, { recurrenceRule: 'BUILTIN' }, { recurrenceGroupId: 'builtin-学生看餐' }, { kind: 'school_milestone' }]) {
    assert.equal(needsManualReminder({ ...task, ...patch }, now), false);
  }
  assert.equal(needsManualReminder({ ...task, recurrenceRule: 'FREQ=WEEKLY' }, now), true);
});
test('month navigation clamps the day and handles leap years and year changes', () => {
  assert.equal(dateKey(movePeriod(new Date(2026, 0, 31), 'month', 1)), '2026-02-28');
  assert.equal(dateKey(movePeriod(new Date(2028, 0, 31), 'month', 1)), '2028-02-29');
  assert.equal(dateKey(movePeriod(new Date(2026, 11, 31), 'month', 1)), '2027-01-31');
  assert.equal(dateKey(movePeriod(new Date(2026, 11, 31), 'week', 1)), '2027-01-07');
});
test('month and week ranges include every local date across boundaries', () => {
  assert.equal(periodDays(new Date(2028, 1, 15), 'month').length, 29);
  assert.equal(periodDays(new Date(2026, 1, 15), 'month').length, 28);
  const days = periodDays(new Date(2027, 0, 1), 'week').map(dateKey);
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-12-28');
  assert.equal(days[6], '2027-01-03');
});
