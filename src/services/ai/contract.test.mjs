import test from 'node:test';
import assert from 'node:assert/strict';
import { localTimestamp, parseAnalysis, validDate } from './contract.ts';

const item = {
  title: '提交回执',
  date: '2026-11-20',
  time: '09:00',
  evidence: '三年二班20日交回执',
  relevance: '本班事项',
  uncertainty: '',
};

test('validates extracted dates and times', () => {
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.throws(() => localTimestamp('2026-11-20', '24:00'));
});

test('requires evidence and limits extraction count', () => {
  assert.throws(() => parseAnalysis({ summary: '', items: [{ ...item, evidence: '' }] }));
  assert.throws(() => parseAnalysis({ summary: '', items: Array(51).fill(item) }));
  assert.equal(parseAnalysis({ summary: '完成', items: [item] }).items[0].title, item.title);
});

test('allows missing dates for user confirmation', () => {
  const result = parseAnalysis({ summary: '', items: [{ ...item, date: null, time: null }] });
  assert.equal(result.items[0].date, null);
  assert.equal(result.items[0].time, null);
});
