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

test('Folio notes include quotes and notes in full mode and keep file activity separate', () => {
  const folio = [
    { app: 'folio', id: 'file-1', kind: 'file-activity', at: '2026-08-17T08:00:00-05:00', updatedAt: '2026-08-17T08:00:00-05:00', title: 'Paper.pdf', data: { actions: ['opened'] } },
    { app: 'folio', id: 'note-1', kind: 'highlight-created', at: '2026-08-17T09:15:00-05:00', updatedAt: '2026-08-17T09:15:00-05:00', title: 'Paper.pdf', data: { documentId: 'doc-1', documentTitle: 'Paper.pdf', locationLabel: 'p. 12', quote: 'Selected text', note: 'My memo' } },
    { app: 'folio', id: 'note-2', kind: 'note-created', at: '2026-08-17T10:00:00-05:00', updatedAt: '2026-08-17T10:00:00-05:00', title: 'Paper.pdf', data: { documentId: 'doc-1', documentTitle: 'Paper.pdf', locationLabel: 'p. 14', note: 'Standalone memo' } },
  ];
  const day = { apps: { ...emptyApps, folio }, records: folio, failures: [] };
  const full = serializeMarkdown({ day, date: '2026-08-17', detail: 'full', timezone: 'America/Chicago' });
  assert.match(full, /## Folio notes/);
  assert.match(full, /### Paper\\\.pdf/);
  assert.match(full, /> Selected text/);
  assert.match(full, /Note: My memo/);
  assert.match(full, /Note: Standalone memo/);
  assert.match(full, /## Files worked with[\s\S]*`Paper\.pdf` · Opened/);
  const compact = serializeMarkdown({ day, date: '2026-08-17', detail: 'compact', timezone: 'America/Chicago' });
  assert.match(compact, /highlight created · 09:15 · p\\\. 12/);
  assert.doesNotMatch(compact, /Selected text|My memo|Standalone memo/);
});

test('non-Folio file apps keep their native activity kinds', () => {
  const slate = { app: 'slate', id: 'board-1', kind: 'board-activity', at: '2026-08-17T11:00:00-05:00', updatedAt: '2026-08-17T11:00:00-05:00', title: 'Ideas', data: { actions: ['edited'] } };
  const grove = { app: 'grove', id: 'map-1', kind: 'map-activity', at: '2026-08-17T12:00:00-05:00', updatedAt: '2026-08-17T12:00:00-05:00', title: 'Map', data: { actions: ['opened'] } };
  const day = { apps: { ...emptyApps, slate: [slate], grove: [grove] }, records: [slate, grove], failures: [] };
  const output = serializeMarkdown({ day, date: '2026-08-17', timezone: 'America/Chicago' });
  assert.match(output, /### Slate[\s\S]*`Ideas` · Edited/);
  assert.match(output, /### Grove[\s\S]*`Map` · Opened/);
});

test('Tide and Loom activities are separate and Compact hides long source content', () => {
  const focus = { app: 'focus', id: 's1', kind: 'session', at: '2026-08-17T09:00:00-05:00', updatedAt: '2026-08-17T09:25:00-05:00', title: 'Focus session', data: { startedAt: '2026-08-17T09:00:00-05:00', endedAt: '2026-08-17T09:25:00-05:00', subject: 'Private subject', task: 'Private task', elapsedSeconds: 1500, completed: true } };
  const tide = { app: 'tide', id: 'c1:2026-08-17', kind: 'item-activity', at: '2026-08-17T10:00:00-05:00', updatedAt: '2026-08-17T10:05:00-05:00', title: 'Private clip title', data: { itemType: 'Clip', actions: ['copied', 'edited'], sourceDate: '2026-08-01', lastAt: '2026-08-17T10:05:00-05:00' } };
  const loom = { app: 'loom', id: 'b1:2026-08-17', kind: 'block-activity', at: '2026-08-17T11:00:00-05:00', updatedAt: '2026-08-17T11:05:00-05:00', title: 'Private block title', data: { actions: ['completed'], sourceDate: '2026-08-20', note: 'Private note' } };
  const day = { apps: { ...emptyApps, focus: [focus], tide: [tide], loom: [loom] }, records: [focus, tide, loom], failures: [] };
  const compact = serializeMarkdown({ day, date: '2026-08-17', detail: 'compact' });
  assert.match(compact, /### Activity[\s\S]*Copied, Edited/);
  assert.match(compact, /### Changes made this day[\s\S]*Completed · scheduled 2026-08-20/);
  assert.doesNotMatch(compact, /Private subject|Private task|Private clip title|Private block title|Private note/);
});
