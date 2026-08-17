import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSourceResults } from '../src/merge.js';
const record = (id, at, updatedAt = at) => ({ id, kind: 'clip', at, updatedAt, title: id, data: {} });
test('one failed app retains only that app cache while successful sources refresh', () => {
  const old = { apps: { tide: [{ ...record('cached', '2026-08-17T08:00:00-05:00'), app: 'tide' }], focus: [] } };
  const results = [{ app: 'tide', records: [], error: new Error('offline') }, { app: 'focus', records: [record('fresh', '2026-08-17T09:00:00-05:00')], diagnostics: [], error: null }];
  const merged = mergeSourceResults(results, old); assert.equal(merged.apps.tide[0].id, 'cached'); assert.equal(merged.apps.focus[0].id, 'fresh'); assert.ok(merged.failures.includes('tide')); assert.equal(merged.records.length, 2);
});
test('timeline order is stable by time then app order', () => {
  const at = '2026-08-17T09:00:00-05:00'; const merged = mergeSourceResults([{ app: 'focus', records: [record('f', at)], error: null }, { app: 'tide', records: [record('t', at)], error: null }]); assert.deepEqual(merged.records.slice(0, 2).map(({ app }) => app), ['tide', 'focus']);
});
