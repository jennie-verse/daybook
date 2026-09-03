import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSourceResults } from '../src/merge.js';
const record = (id, at, updatedAt = at) => ({ id, kind: 'clip', at, updatedAt, title: id, data: {} });
test('one failed app retains only that app cache while successful sources refresh', () => {
  const old = { apps: { clip: [{ ...record('cached', '2026-08-17T08:00:00-05:00'), app: 'clip' }], focus: [] } };
  const results = [{ app: 'clip', records: [], error: new Error('offline') }, { app: 'focus', records: [record('fresh', '2026-08-17T09:00:00-05:00')], diagnostics: [], error: null }];
  const merged = mergeSourceResults(results, old); assert.equal(merged.apps.clip[0].id, 'cached'); assert.equal(merged.apps.focus[0].id, 'fresh'); assert.ok(merged.failures.includes('clip')); assert.equal(merged.records.length, 2);
});
test('timeline order is stable by time then app order', () => {
  const at = '2026-08-17T09:00:00-05:00'; const merged = mergeSourceResults([{ app: 'focus', records: [record('f', at)], error: null }, { app: 'clip', records: [record('t', at)], error: null }]); assert.deepEqual(merged.records.slice(0, 2).map(({ app }) => app), ['clip', 'focus']);
});
