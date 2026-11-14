import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { lessonReminderPlan, validateLessonTimes } from './lessonReminderPlan.ts';

const times = ['08:00', '08:50', '09:50', '10:40', '14:00', '14:50', '15:50', '16:40'];
const now = new Date(2026, 10, 9, 7);
const lesson = { id: 'a', timetableId: 'teacher', weekday: 1, period: 1, subject: '数学', room: '三年一班', adjustmentType: 'temporary', effectiveFrom: now.getTime(), effectiveUntil: new Date(2026, 10, 16).getTime() };

test('uses fixed lesson start time and reminds exactly ten minutes before', () => {
  const [item] = lessonReminderPlan('teacher', [lesson], times, now);
  assert.equal(item.eventAt, new Date(2026, 10, 9, 8).getTime());
  assert.equal(item.remindAt, new Date(2026, 10, 9, 7, 50).getTime());
  assert.equal(item.eventDate, '2026-11-09');
  assert.match(item.content, /数学.*三年一班/);
});
test('does not create reminders for regular, long-term, expired or past lessons', () => {
  for (const patch of [{ adjustmentType: null }, { adjustmentType: 'long_term' }, { effectiveUntil: now.getTime() }]) {
    assert.deepEqual(lessonReminderPlan('teacher', [{ ...lesson, ...patch }], times, now), []);
  }
  assert.deepEqual(lessonReminderPlan('teacher', [lesson], times, new Date(2026, 10, 9, 9)), []);
  const [late] = lessonReminderPlan('teacher', [lesson], times, new Date(2026, 10, 9, 7, 55));
  assert.equal(late.remindAt, new Date(2026, 10, 9, 7, 50).getTime());
});
test('validates all eight times without inventing a schedule', () => {
  for (const invalid of [[], Array(8).fill(''), ['24:00', ...times.slice(1)], ['08:99', ...times.slice(1)], [...times].reverse()]) assert.throws(() => validateLessonTimes(invalid));
});

function harness() {
  const sql = new DatabaseSync(':memory:');
  const root = path.resolve('src');
  const require = createRequire(import.meta.url);
  const cache = new Map();
  const notifications = new Map();
  let sequence = 0;
  const db = {
    runAsync: async (query, ...params) => sql.prepare(query).run(...params),
    getFirstAsync: async (query, ...params) => sql.prepare(query).get(...params) ?? null,
    getAllAsync: async (query, ...params) => sql.prepare(query).all(...params),
    execAsync: async query => sql.exec(query),
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const localRequire = specifier => {
      if (specifier === './database' || specifier === '@/data/database') return { getDatabase: async () => db };
      if (specifier === './operationLog') return { writeOperationLog: async () => {} };
      if (specifier === '@/services/notifications/notificationService') return {
        cancelTaskNotification: async id => notifications.delete(id),
        scheduleTaskNotification: async task => { const id = `notification-${++sequence}`; notifications.set(id, task); return id; },
      };
      if (specifier.startsWith('@/') || specifier.startsWith('.')) {
        return load((specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(file), specifier)) + '.ts');
      }
      return require(specifier);
    };
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInThisContext(`(function(require, module, exports) {${code}\n})`, { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  sql.exec(load(path.join(root, 'data/schema.ts')).SCHEMA_SQL);
  return { sql, notifications, service: load(path.join(root, 'services/timetable/lessonReminders.ts')) };
}

test('SQLite synchronization deduplicates, reschedules and cancels lesson reminders', async () => {
  const { sql, notifications, service } = harness();
  // Fake wall clock keeps this test independent of the actual weekday and time.
  const RealDate = globalThis.Date;
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } static now() { return now.getTime(); } };
  try {
    await service.saveLessonTimes(times);
    await service.syncLessonReminders('teacher', [lesson]);
    await service.syncLessonReminders('teacher', [lesson]);
    assert.equal(sql.prepare("SELECT count(*) n FROM task_occurrences WHERE status = 'active'").get().n, 1);
    assert.equal(notifications.size, 1);
    await service.syncLessonReminders('teacher', [{ ...lesson, subject: '语文' }]);
    assert.equal(notifications.size, 1);
    assert.match([...notifications.values()][0].content, /语文/);
    await service.saveLessonTimes(['08:10', ...times.slice(1)]);
    await service.syncLessonReminders('teacher', [{ ...lesson, subject: '语文' }]);
    assert.equal(notifications.size, 1);
    assert.equal([...notifications.values()][0].remindAt, new RealDate(2026, 10, 9, 8).getTime());
    await service.syncLessonReminders('teacher', []);
    assert.equal(notifications.size, 0);
    assert.equal(sql.prepare("SELECT count(*) n FROM task_occurrences WHERE status = 'active'").get().n, 0);
  } finally { globalThis.Date = RealDate; sql.close(); }
});
