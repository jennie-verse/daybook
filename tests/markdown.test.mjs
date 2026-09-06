import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, formatDuration, formatTimeRange, serializeMarkdown } from '../src/markdown.js';

const emptyApps = { clip: [], focus: [], loom: [], today: [], petal: [], folio: [], cove: [], quill: [], slate: [], grove: [] };
const dayWith = (apps, failures = []) => ({ apps: { ...emptyApps, ...apps }, records: Object.values(apps).flat(), failures });
const session = (app, kind, title, startedAt, endedAt, activeSeconds) => ({ app, id: `${app}-session`, kind, at: endedAt, updatedAt: endedAt, title, data: { startedAt, endedAt, activeSeconds } });

test('frontmatter keeps only date, time, and status with a stable snapshot', () => {
  const options = { day: dayWith({}), date: '2026-08-31', snapshotAt: new Date('2026-08-31T14:05:00-05:00') };
  const output = serializeMarkdown(options);
  assert.match(output, /^---\ndate: 2026-08-31\ntime: "(?:[1-9]|1[0-2]):05 [AP]M"\nstatus: complete\n---/);
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

test('Today groups additions and marks undone tasks cancelled for that day (Personal Standards Guide notation)', () => {
  const today = [
    { app: 'today', id: 'a', kind: 'task', at: '2026-08-31T09:00:00-05:00', updatedAt: '2026-08-31T09:00:00-05:00', title: 'Finished', data: { done: true } },
    { app: 'today', id: 'b:2026-08-31', kind: 'task-activity', at: '2026-08-31T09:10:00-05:00', updatedAt: '2026-08-31T09:10:00-05:00', title: 'Later', data: { destination: 'someday', done: false, actions: ['deferred'] } },
    { app: 'today', id: 'c', kind: 'task', at: '2026-08-31T09:20:00-05:00', updatedAt: '2026-08-31T09:20:00-05:00', title: 'Still open', data: { done: false } },
  ];
  const output = serializeMarkdown({ day: dayWith({ today }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /### Added to Today[\s\S]*- \[x\] Finished[\s\S]*- \[-\] ~~Still open~~/);
  assert.doesNotMatch(output, /Added to Someday|Later/);
  assert.doesNotMatch(output, /Changes made this day|Created|Moved to/);
});

test("Today renders by data.type — hyphen bullet for Note, HH:MM for Event, checkbox for Task or missing type", () => {
  const today = [
    { app: 'today', id: 'n1', kind: 'task', at: '2026-08-31T09:00:00-05:00', updatedAt: '2026-08-31T09:00:00-05:00', title: 'A stray thought', data: { done: false, type: 'note' } },
    { app: 'today', id: 'e1', kind: 'task', at: '2026-08-31T14:30:00-05:00', updatedAt: '2026-08-31T14:30:00-05:00', title: 'Dentist', data: { done: false, type: 'event', hasTime: true } },
    { app: 'today', id: 't1', kind: 'task', at: '2026-08-31T09:05:00-05:00', updatedAt: '2026-08-31T09:05:00-05:00', title: 'Untyped task', data: { done: false } },
  ];
  const output = serializeMarkdown({ day: dayWith({ today }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /- A stray thought/);
  assert.doesNotMatch(output, /— A stray thought/);
  assert.match(output, /- 2:30 PM Dentist/);
  assert.match(output, /- \[-\] ~~Untyped task~~/);
});

test('an Event with no scheduled time shows the 00:00 all-day placeholder and sorts before timed events', () => {
  const today = [
    { app: 'today', id: 'e-timed', kind: 'task', at: '2026-08-31T14:30:00-05:00', updatedAt: '2026-08-31T14:30:00-05:00', title: 'Dentist', data: { done: false, type: 'event', hasTime: true } },
    { app: 'today', id: 'e-allday', kind: 'task', at: '2026-08-31T20:00:00-05:00', updatedAt: '2026-08-31T20:00:00-05:00', title: 'Friend birthday', data: { done: false, type: 'event', hasTime: false } },
  ];
  const output = serializeMarkdown({ day: dayWith({ today }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /- 00:00 Friend birthday/);
  assert.match(output, /- 2:30 PM Dentist/);
  const addedIndex = output.indexOf('### Added to Today');
  assert.ok(output.indexOf('Friend birthday', addedIndex) < output.indexOf('Dentist', addedIndex), 'all-day event lists before the timed event');
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

test('Petal sessions and Clip content keep the compact shared clock style', () => {
  const petal = { ...session('petal', 'reading-session', 'Book', '2026-08-31T08:00:00-05:00', '2026-08-31T08:25:00-05:00', 1200), data: { startedAt: '2026-08-31T08:00:00-05:00', endedAt: '2026-08-31T08:25:00-05:00', activeSeconds: 1200, bookId: 'book', bookTitle: 'Book', startProgression: .1, endProgression: .2 } };
  const clipRecord = { app: 'clip', id: 't1', kind: 'clip', at: '2026-08-31T15:14:00-05:00', updatedAt: '2026-08-31T15:14:00-05:00', title: 'Clip', data: { text: 'A useful idea' } };
  const output = serializeMarkdown({ day: dayWith({ petal: [petal], clip: [clipRecord] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /## Petal[\s\S]*8:00–8:25 AM · \(20m\) · \*Book\* · 10% → 20%/);
  assert.match(output, /## Clip\n\n- 3:14 PM\n\n {2}> A useful idea/);
});

test('partial and cached status remain distinct', () => {
  assert.match(serializeMarkdown({ day: dayWith({}, ['slate']), date: '2026-08-31', snapshotAt: 0 }), /status: partial/);
  assert.match(serializeMarkdown({ day: { ...dayWith({}, ['slate']), cached: true }, date: '2026-08-31', snapshotAt: 0 }), /status: cached/);
});

/* ── 2026-09-01 Revision 4 regression tests ──────────────────────────── */

test('A-3: a task completed then reopened is not shown done, even if "completed" is still in its actions', () => {
  const reopened = {
    app: 'today', id: 'x:2026-08-31', kind: 'task-activity',
    at: '2026-08-31T09:10:00-05:00', updatedAt: '2026-08-31T09:10:00-05:00', title: 'SQL',
    data: { destination: 'today', done: false, finalStatus: 'today', actions: ['created', 'promoted', 'completed', 'reopened'] },
  };
  const output = serializeMarkdown({ day: dayWith({ today: [reopened] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /### Added to Today\n\n- \[-\] ~~SQL~~/);
  assert.doesNotMatch(output, /- \[x\] SQL/);
});

test('A-3: finalStatus alone (no explicit done field) is still trusted over stale actions', () => {
  const record = {
    app: 'today', id: 'y:2026-08-31', kind: 'task-activity',
    at: '2026-08-31T09:10:00-05:00', updatedAt: '2026-08-31T09:10:00-05:00', title: 'Today task',
    data: { destination: 'today', finalStatus: 'today', actions: ['created', 'completed', 'deferred'] },
  };
  const output = serializeMarkdown({ day: dayWith({ today: [record] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /### Added to Today\n\n- \[-\] ~~Today task~~/);
});

test('Someday tasks never reach the day\'s Markdown — Today section is omitted entirely when everything is deferred', () => {
  const someday = { app: 'today', id: 'z:2026-08-31', kind: 'task-activity', at: '2026-08-31T09:10:00-05:00', updatedAt: '2026-08-31T09:10:00-05:00', title: 'Read later', data: { destination: 'someday', done: false, actions: ['deferred'] } };
  const output = serializeMarkdown({ day: dayWith({ today: [someday] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.doesNotMatch(output, /## Today|Read later|Someday/);
});

test('B-1: Cove distinguishes exact, approximate, and duration-less external reads', () => {
  const exact = { app: 'cove', id: 'c1', kind: 'reading-session', at: '2026-08-31T20:36:00-04:00', updatedAt: '2026-08-31T20:36:00-04:00', title: 'In-app article', data: { startedAt: '2026-08-31T20:10:00-04:00', endedAt: '2026-08-31T20:36:00-04:00', activeSeconds: 1560, historyAccuracy: 'exact' } };
  const approx = { app: 'cove', id: 'c2', kind: 'reading-session', at: '2026-08-31T21:32:00-04:00', updatedAt: '2026-08-31T21:32:00-04:00', title: 'Safari article', data: { startedAt: '2026-08-31T21:10:00-04:00', endedAt: '2026-08-31T21:32:00-04:00', activeSeconds: 1320, historyAccuracy: 'approximate', source: 'external' } };
  const noDuration = { app: 'cove', id: 'c3', kind: 'reading-session', at: '2026-08-31T22:10:00-04:00', updatedAt: '2026-08-31T23:20:00-04:00', title: 'Long-gone article', data: { startedAt: '2026-08-31T22:10:00-04:00', activeSeconds: 0, historyAccuracy: 'approximate', source: 'external' } };
  const output = serializeMarkdown({ day: dayWith({ cove: [exact, approx, noDuration] }), date: '2026-08-31', snapshotAt: '2026-08-31T23:59:00-04:00' });
  assert.match(output, /- 8:10–8:36 PM · \(26m\) · In-app article/);
  assert.match(output, /- 9:10–9:32 PM · \(~22m\) · Safari article/);
  assert.match(output, /- 10:10 PM · Long-gone article/);
  assert.doesNotMatch(output, /Long-gone article.*\(/);
});

test('B-2: Focus break sessions are excluded, legacy sessions with no mode still show', () => {
  const focusSession = { app: 'focus', id: 'f1', kind: 'session', at: '2026-08-31T10:32:00-05:00', updatedAt: '2026-08-31T10:32:00-05:00', title: 'Focus session', data: { startedAt: '2026-08-31T10:02:00-05:00', endedAt: '2026-08-31T10:32:00-05:00', elapsedSeconds: 1800, mode: 'focus', subject: 'SQL' } };
  const breakSession = { app: 'focus', id: 'f2', kind: 'session', at: '2026-08-31T10:37:00-05:00', updatedAt: '2026-08-31T10:37:00-05:00', title: 'Break', data: { startedAt: '2026-08-31T10:32:00-05:00', endedAt: '2026-08-31T10:37:00-05:00', elapsedSeconds: 300, mode: 'break' } };
  const legacySession = { app: 'focus', id: 'f3', kind: 'session', at: '2026-08-31T11:00:00-05:00', updatedAt: '2026-08-31T11:00:00-05:00', title: 'Focus session', data: { startedAt: '2026-08-31T10:45:00-05:00', endedAt: '2026-08-31T11:00:00-05:00', elapsedSeconds: 900, subject: 'Reading' } };
  const output = serializeMarkdown({ day: dayWith({ focus: [focusSession, breakSession, legacySession] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /10:02–10:32 AM · \(30m\) · SQL/);
  assert.match(output, /10:45–11:00 AM · \(15m\) · Reading/);
  assert.doesNotMatch(output, /Break/);
});

test('B-3: Petal omits the progression suffix entirely when no progression was recorded', () => {
  const noProgress = { app: 'petal', id: 'p1', kind: 'reading-session', at: '2026-08-31T20:20:00-05:00', updatedAt: '2026-08-31T20:20:00-05:00', title: 'No Progress Book', data: { startedAt: '2026-08-31T20:05:00-05:00', endedAt: '2026-08-31T20:20:00-05:00', activeSeconds: 900, bookId: 'b', bookTitle: 'No Progress Book' } };
  const output = serializeMarkdown({ day: dayWith({ petal: [noProgress] }), date: '2026-08-31', snapshotAt: '2026-08-31T21:00:00-05:00' });
  assert.match(output, /## Petal\n\n- 8:05–8:20 PM · \(15m\) · \*No Progress Book\*\n/);
  assert.doesNotMatch(output, /0% → 0%/);
});

test('B-3: Petal has the same tight spacing as Focus/Folio (no blank line between items)', () => {
  const a = { app: 'petal', id: 'p1', kind: 'reading-session', at: '2026-08-31T20:20:00-05:00', updatedAt: '2026-08-31T20:20:00-05:00', title: 'Book A', data: { startedAt: '2026-08-31T20:05:00-05:00', endedAt: '2026-08-31T20:20:00-05:00', activeSeconds: 900, bookId: 'a', bookTitle: 'Book A' } };
  const b = { app: 'petal', id: 'p2', kind: 'reading-session', at: '2026-08-31T21:20:00-05:00', updatedAt: '2026-08-31T21:20:00-05:00', title: 'Book B', data: { startedAt: '2026-08-31T21:05:00-05:00', endedAt: '2026-08-31T21:20:00-05:00', activeSeconds: 900, bookId: 'b', bookTitle: 'Book B' } };
  const output = serializeMarkdown({ day: dayWith({ petal: [a, b] }), date: '2026-08-31', snapshotAt: '2026-08-31T22:00:00-05:00' });
  assert.match(output, /## Petal\n\n- 8:05–8:20 PM · \(15m\) · \*Book A\*\n- 9:05–9:20 PM · \(15m\) · \*Book B\*/);
});

test('B-4: Tide quotes nest two spaces under the list item and survive Compact mode', () => {
  const clip = { app: 'clip', id: 't1', kind: 'clip', at: '2026-08-31T21:08:00-05:00', updatedAt: '2026-08-31T21:08:00-05:00', title: 'Clip', data: { text: 'line one\nline two' } };
  const full = serializeMarkdown({ day: dayWith({ clip: [clip] }), date: '2026-08-31', detail: 'full', snapshotAt: '2026-08-31T22:00:00-05:00' });
  const compact = serializeMarkdown({ day: dayWith({ clip: [clip] }), date: '2026-08-31', detail: 'compact', snapshotAt: '2026-08-31T22:00:00-05:00' });
  assert.match(full, /- 9:08 PM\n\n {2}> line one\n {2}> line two\n/);
  assert.match(compact, /- 9:08 PM\n\n {2}> line one\n {2}> line two\n/);
});

test('B-5: front matter time never contains U+202F, even though Safari 16.4+ would insert it via toLocaleTimeString', () => {
  const output = serializeMarkdown({ day: dayWith({}), date: '2026-08-31', snapshotAt: new Date(2026, 7, 31, 21, 42) });
  assert.doesNotMatch(output, / /);
  assert.match(output, /time: "9:42 PM"/);
});

test('B-6: a section is sorted by displayed clock, not input array order, with a stable tie-break', () => {
  const later = { app: 'slate', id: 'z-later', kind: 'usage-session', at: '2026-08-31T15:44:00-05:00', updatedAt: '2026-08-31T15:44:00-05:00', title: 'Board B', data: { startedAt: '2026-08-31T15:10:00-05:00', endedAt: '2026-08-31T15:44:00-05:00', activeSeconds: 2000 } };
  const earlier = { app: 'slate', id: 'a-earlier', kind: 'usage-session', at: '2026-08-31T09:05:00-05:00', updatedAt: '2026-08-31T09:05:00-05:00', title: 'Board A', data: { startedAt: '2026-08-31T08:40:00-05:00', endedAt: '2026-08-31T09:05:00-05:00', activeSeconds: 1400 } };
  const output = serializeMarkdown({ day: dayWith({ slate: [later, earlier] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  const boardAIndex = output.indexOf('Board A');
  const boardBIndex = output.indexOf('Board B');
  assert.ok(boardAIndex > -1 && boardBIndex > -1 && boardAIndex < boardBIndex, 'the earlier session must render before the later one regardless of input order');
});

test('B-7: Loom keeps block-activity/subtitle/detail, and sections are ordered Focus..Grove, Loom, Quill, Daily note', () => {
  const block = { app: 'loom', id: 'l1', kind: 'block', at: '2026-08-31T00:00:00-05:00', updatedAt: '2026-08-31T00:00:00-05:00', title: 'Design review', data: { start: 540, duration: 30, done: true, subtitle: 'Weekly sync', note: 'bring notes', detail: 'room 4B' } };
  const change = { app: 'loom', id: 'l1-activity:2026-08-31', kind: 'block-activity', at: '2026-08-31T09:05:00-05:00', updatedAt: '2026-08-31T09:05:00-05:00', title: 'Design review', data: { lastAt: '2026-08-31T09:05:00-05:00', actions: ['moved'] } };
  const quillFile = { app: 'quill', id: 'q1', kind: 'file-activity', at: '2026-08-31T09:00:00-05:00', updatedAt: '2026-08-31T09:00:00-05:00', title: 'notes.md', data: { lastAt: '2026-08-31T09:00:00-05:00' } };
  const output = serializeMarkdown({ day: dayWith({ loom: [block, change], quill: [quillFile] }), date: '2026-08-31', detail: 'full', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /## Loom\n\n- \[x\] 9:00–9:30 AM · Design review\n {2}- Subtitle: Weekly sync\n {2}- Note: bring notes\n {2}- Detail: room 4B/);
  assert.match(output, /### Changes made this day\n\n- 9:05 AM · Moved/);
  const loomIndex = output.indexOf('## Loom');
  const quillIndex = output.indexOf('## Quill');
  const groveOrCoveIndex = output.indexOf('## Daily note');
  assert.ok(loomIndex < quillIndex && quillIndex < groveOrCoveIndex, 'Loom must come before Quill, and both before Daily note');
});

test('C-7: mdText does not escape hyphens, and Preview never shows a backslash', () => {
  const record = { app: 'folio', id: 'r1', kind: 'reading-session', at: '2026-08-31T10:00:00-05:00', updatedAt: '2026-08-31T10:00:00-05:00', title: 'reading-1', data: { startedAt: '2026-08-31T09:40:00-05:00', endedAt: '2026-08-31T10:00:00-05:00', activeSeconds: 1200 } };
  const output = serializeMarkdown({ day: dayWith({ folio: [record] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /`reading-1`/);
  assert.doesNotMatch(output, /reading\\-1/);
});

test('Cove: a highlight with no note reaches Daybook as a highlight-only entry', () => {
  const record = { app: 'cove', id: 'h1', kind: 'highlight-created', at: '2026-08-31T09:15:00-05:00', updatedAt: '2026-08-31T09:15:00-05:00', title: 'Article One', data: { itemId: 'item-1', color: 'pink', quote: 'A quoted line.' } };
  const output = serializeMarkdown({ day: dayWith({ cove: [record] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /## Cove\n\n### Notes\n\n#### Article One\n\n- 9:15 AM\n\n> A quoted line\./);
  assert.doesNotMatch(output, /Note:/);
});

test('Cove: a highlight with an attached note clearly separates quote from note', () => {
  const record = { app: 'cove', id: 'h2', kind: 'highlight-created', at: '2026-08-31T09:20:00-05:00', updatedAt: '2026-08-31T09:20:00-05:00', title: 'Article Two', data: { itemId: 'item-2', color: 'yellow', quote: 'The highlighted quote.', note: 'My own thought about it.' } };
  const output = serializeMarkdown({ day: dayWith({ cove: [record] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /#### Article Two\n\n- 9:20 AM\n\n> The highlighted quote\.\n\n {2}Note: My own thought about it\./);
});

test('Cove: a whole-document note (no highlight) reaches Daybook separately, with no quote', () => {
  const record = { app: 'cove', id: 'n1', kind: 'note-created', at: '2026-08-31T09:25:00-05:00', updatedAt: '2026-08-31T09:25:00-05:00', title: 'Article Three', data: { itemId: 'item-3', note: 'A general reading note.' } };
  const output = serializeMarkdown({ day: dayWith({ cove: [record] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00' });
  assert.match(output, /#### Article Three\n\n- 9:25 AM\n {2}Note: A general reading note\./);
  assert.doesNotMatch(output, /> A general reading note/);
});

test('Cove: Notes are omitted from Compact detail, same as Folio', () => {
  const record = { app: 'cove', id: 'h3', kind: 'highlight-created', at: '2026-08-31T09:30:00-05:00', updatedAt: '2026-08-31T09:30:00-05:00', title: 'Article Four', data: { itemId: 'item-4', quote: 'Quiet quote.' } };
  const output = serializeMarkdown({ day: dayWith({ cove: [record] }), date: '2026-08-31', snapshotAt: '2026-08-31T18:00:00-05:00', detail: 'compact' });
  assert.doesNotMatch(output, /## Cove/);
});
