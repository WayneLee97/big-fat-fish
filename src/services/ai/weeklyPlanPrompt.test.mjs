import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { buildWeeklyPlanRequest } from './weeklyPlanPrompt.ts';
import * as contract from './contract.ts';

test('normalizes multiple classes and calculates the current week across years', () => {
  const result = buildWeeklyPlanRequest([' 三年一班 ', '三年二班', '三年一班', ''], new Date(2027, 0, 1));
  assert.deepEqual(result.classNames, ['三年一班', '三年二班']);
  assert.deepEqual(result.currentWeek, { start: '2026-12-28', end: '2027-01-03' });
  assert.match(result.request, /三年一班、三年二班/);
});

test('analysis reads latest classes each time and keeps the existing suggestion contract', async () => {
  let classes = [{ name: '三年一班' }, { name: '三年二班' }];
  const requests = [];
  const suggestion = { title: '数学教研', date: '2026-11-20', time: '14:00', evidence: '数学教师周五下午教研', relevance: '数学教学活动', uncertainty: '' };
  const mockRequire = name => {
    if (name === '@/data/schoolRepository') return { listClasses: async () => classes };
    if (name === './weeklyPlanPrompt') return { buildWeeklyPlanRequest };
    if (name === './contract') return contract;
    if (name === 'react-native') return { Platform: { OS: 'ios' } };
    return {};
  };
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('./client.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(`(function(require, module, exports) {${code}\n})`, {
    AbortController, setTimeout, clearTimeout,
    fetch: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ summary: '待确认', items: [suggestion] }) } }] }) };
    },
  })(mockRequire, module, module.exports);
  const input = { apiKey: 'test-only-placeholder-key', model: 'deepseek-flash', text: '学校周计划', file: null };
  const result = await module.exports.analyzeDocument(input);
  assert.deepEqual(JSON.parse(JSON.stringify(result.items)), [suggestion]);
  const payload = index => JSON.parse(requests[index].messages[1].content[0].text);
  assert.deepEqual(payload(0).classNames, ['三年一班', '三年二班']);
  assert.equal('profile' in payload(0), false);
  classes = [{ name: '四年一班' }];
  await module.exports.analyzeDocument(input);
  assert.deepEqual(payload(1).classNames, ['四年一班']);
  classes = [];
  await module.exports.analyzeDocument(input);
  assert.deepEqual(payload(2).classNames, []);
  assert.match(payload(2).request, /尚未添加班级/);
  assert.match(payload(2).request, /数学教学/);
  assert.match(payload(2).request, /所有人员或者所有老师/);
});
