import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, formatDuration, formatTimeRange, serializeMarkdown } from '../src/markdown.js';

const emptyApps = { tide: [], focus: [], loom: [], today: [], petal: [], folio: [], cove: [], quill: [], slate: [], grove: [] };
const dayWith = (apps, failures = []) => ({ apps: { ...emptyApps, ...apps }, records: Object.values(apps).flat(), failures });
const session = (app, kind, title, startedAt, endedAt, activeSeconds) => ({ app, id: `${app}-session`, kind, at: endedAt, updatedAt: endedAt, title, data: { startedAt, endedAt, activeSeconds } });

test('frontmatter keeps only date, time, and status with a stable snapshot', () => {
  const options = { day: dayWith({}), date: '2026-08-31', snapshotAt: new Date('2026-08-31T14:05:00-05:00') };
  const output = serializeMarkdown(options);
  assert.match(output, /^---\ndate: 2026-08-31\ntime: "2:05 PM"\nstatus: complete\n---/);
  assert.doesNotMatch(output, /timezone:|apps:|generated_at/);
  assert.match(output, /# Monday, August 31, 2026/);
  assert.equal(output, serializeMarkdown(options));
});

test('AM/PM ranges and durations are concise and consistent', () => {
  assert.equal(formatClock('2026-08-31T09:02:00-05:00'), '9:02 AM');
  assert.equal(formatTimeRange('2026-08-31T10:02:00-05:00', '2026-08-31T10:32:00-05:00'), '10:02–10:32 AM');
  assert.equal(formatTimeRange('2026-08-31T11:50:00-05:00', '2026-08-31T12:10:00-05:00'), '11:50 AM–12:10 PM');
  assert.equal(formatDuration(30), '<1m');
  assert.equal(formatDuration(1800), '30m');
  assert.equal(formatDuration(4500), '1h 15m');
});

test('Focus omits labels, planning, and completion noise', () => {
  const focus = { app: 'focus', id: 'f1', kind: 'session', at: '2026-08-31T10:32:00-05:00', updatedAt: '2026-08-31T10:32:00-05:00', title: 'Focus session', data: { startedAt: '2026-08-31T10:02:00-05:00', endedAt: '2026-08-31T10:32:00-05:00', elapsedSeconds: 1800, plannedSeconds: 1800, completed: true, subject: 'SQL' } };
  const output = serializeMarkdown({ day: dayWith({ focus: [focus] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /## Focus\n\n- 10:02–10:32 AM · \(30m\) · SQL/);
  assert.doesNotMatch(output, /Focus session|planned|Completed/);
});

test('Today groups additions and strikes incomplete tasks', () => {
  const today = [
    { app: 'today', id: 'a', kind: 'task', at: '2026-08-31T09:00:00-05:00', updatedAt: '2026-08-31T09:00:00-05:00', title: 'Finished', data: { done: true } },
    { app: 'today', id: 'b:2026-08-31', kind: 'task-activity', at: '2026-08-31T09:10:00-05:00', updatedAt: '2026-08-31T09:10:00-05:00', title: 'Later', data: { destination: 'someday', done: false, actions: ['deferred'] } },
    { app: 'today', id: 'c', kind: 'task', at: '2026-08-31T09:20:00-05:00', updatedAt: '2026-08-31T09:20:00-05:00', title: 'Still open', data: { done: false } },
  ];
  const output = serializeMarkdown({ day: dayWith({ today }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /### Added to Today[\s\S]*- \[x\] Finished[\s\S]*- \[ \] ~~Still open~~/);
  assert.match(output, /### Added to Someday[\s\S]*- \[ \] ~~Later~~/);
  assert.doesNotMatch(output, /Changes made this day|Created|Moved to/);
});

test('reading and usage apps export ranges and active duration only', () => {
  const started = '2026-08-31T13:10:00-05:00'; const ended = '2026-08-31T13:55:00-05:00';
  const output = serializeMarkdown({ day: dayWith({ folio: [session('folio', 'reading-session', 'Paper.pdf', started, ended, 2100)], cove: [session('cove', 'reading-session', 'Article', started, ended, 1800)], slate: [session('slate', 'usage-session', 'Research board', started, ended, 1200)], grove: [session('grove', 'usage-session', 'SQL map', started, ended, 900)] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /## Folio\n\n- 1:10–1:55 PM · \(35m\) · `Paper\.pdf`/);
  assert.match(output, /## Cove\n\n- 1:10–1:55 PM · \(30m\) · Article/);
  assert.match(output, /## Slate\n\n- 1:10–1:55 PM · \(20m\) · `Research board`/);
  assert.match(output, /## Grove\n\n- 1:10–1:55 PM · \(15m\) · `SQL map`/);
  assert.doesNotMatch(output, /Added|Opened|Read$/m);
});

test('Petal sessions and Tide content keep the compact shared clock style', () => {
  const petal = { ...session('petal', 'reading-session', 'Book', '2026-08-31T08:00:00-05:00', '2026-08-31T08:25:00-05:00', 1200), data: { startedAt: '2026-08-31T08:00:00-05:00', endedAt: '2026-08-31T08:25:00-05:00', activeSeconds: 1200, bookId: 'book', bookTitle: 'Book', startProgression: .1, endProgression: .2 } };
  const tide = { app: 'tide', id: 't1', kind: 'clip', at: '2026-08-31T15:14:00-05:00', updatedAt: '2026-08-31T15:14:00-05:00', title: 'Clip', data: { text: 'A useful idea' } };
  const output = serializeMarkdown({ day: dayWith({ petal: [petal], tide: [tide] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /## Petal[\s\S]*8:00–8:25 AM · \(20m\) · \*Book\* · 10% → 20%/);
  assert.match(output, /## Tide\n\n- 3:14 PM\n\n> A useful idea/);
});

test('partial and cached status remain distinct', () => {
  assert.match(serializeMarkdown({ day: dayWith({}, ['slate']), date: '2026-08-31', snapshotAt: 0 }), /status: partial/);
  assert.match(serializeMarkdown({ day: { ...dayWith({}, ['slate']), cached: true }, date: '2026-08-31', snapshotAt: 0 }), /status: cached/);
});
