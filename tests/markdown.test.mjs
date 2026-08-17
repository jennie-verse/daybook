import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeMarkdown } from '../src/markdown.js';
const emptyApps = { tide: [], focus: [], loom: [], petal: [], folio: [], quill: [], slate: [], grove: [] };
test('Markdown is deterministic, safe, and uses the required file structure', () => {
  const day = { apps: { ...emptyApps, tide: [{ app: 'tide', id: '한글', kind: 'clip', at: '2026-08-17T08:12:00-05:00', updatedAt: '2026-08-17T08:12:00-05:00', title: 'Clip', data: { label: '# phrase | emoji 🌱', type: 'Text', text: '<script>alert(1)</script>\n백틱 ` test' } }] }, records: [], failures: [] };
  const options = { day, date: '2026-08-17', note: '## manual\n사용자 **Markdown**', timezone: 'America/Chicago' }; const first = serializeMarkdown(options); const second = serializeMarkdown(options);
  assert.equal(first, second); assert.match(first, /^---\ndate: 2026-08-17\ntimezone: America\/Chicago\napps:\n  - tide\nstatus: complete/m); assert.match(first, /# Monday, August 17, 2026/); assert.match(first, /> <script>alert\(1\)<\/script>/); assert.match(first, /## Daily note\n\n## manual/); assert.doesNotMatch(first, /generated_at/);
});
test('partial and cached status are serialized distinctly', () => {
  assert.match(serializeMarkdown({ day: { apps: emptyApps, records: [], failures: ['slate'] }, date: '2026-08-17' }), /status: partial/);
  assert.match(serializeMarkdown({ day: { apps: emptyApps, records: [], failures: ['slate'], cached: true }, date: '2026-08-17' }), /status: cached/);
});
