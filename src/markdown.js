import { folioGroups, folioNoteRecords, petalGroups, safeText } from './day-model.js';

const mdText = (value) => safeText(value).replace(/([\\`*_[\]{}<>#+.!|~-])/g, '\\$1');
const quote = (value) => safeText(value).split('\n').map((line) => `> ${line}`).join('\n');
const codeSpan = (value) => { const body = safeText(value); const ticks = Math.max(1, ...(body.match(/`+/g) || []).map((match) => match.length + 1)); const fence = '`'.repeat(ticks); return `${fence}${body}${fence}`; };
const parts = (iso) => { const match = safeText(iso).match(/T(\d{2}):(\d{2})/); return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null; };
const clockParts = ({ hour, minute }) => `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
export const formatClock = (iso) => { const value = parts(iso); return value ? clockParts(value) : '--:--'; };
export const formatTimeRange = (startIso, endIso) => {
  const start = parts(startIso); const end = parts(endIso); if (!start || !end) return '--:--';
  const startPeriod = start.hour < 12 ? 'AM' : 'PM'; const endPeriod = end.hour < 12 ? 'AM' : 'PM';
  const startClock = `${start.hour % 12 || 12}:${String(start.minute).padStart(2, '0')}`;
  const endClock = `${end.hour % 12 || 12}:${String(end.minute).padStart(2, '0')} ${endPeriod}`;
  return startPeriod === endPeriod ? `${startClock}–${endClock}` : `${startClock} ${startPeriod}–${endClock}`;
};
export const formatDuration = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0); if (value <= 0) return '';
  if (value < 60) return '<1m'; const minutes = Math.round(value / 60); const hours = Math.floor(minutes / 60); const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${minutes}m`;
};
const sessionLine = (record, target, suffix = '') => {
  const data = record.data || {}; const value = formatDuration(data.activeSeconds ?? data.elapsedSeconds);
  return `- ${formatTimeRange(data.startedAt, data.endedAt)}${value ? ` · (${value})` : ''} · ${target}${suffix}`;
};
const rangeFromMinutes = (start, duration) => {
  const a = Number(start || 0); const b = a + Number(duration || 0);
  const iso = (value) => `2000-01-01T${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}:00+00:00`;
  return formatTimeRange(iso(a), iso(b));
};

function focus(records) {
  const rows = records.filter((record) => record.kind === 'session').map((record) => {
    const data = record.data || {}; const target = data.subject || data.task || (data.mode === 'break' ? 'Break' : 'Focus');
    return sessionLine({ ...record, data: { ...data, activeSeconds: data.elapsedSeconds } }, mdText(target));
  });
  return rows.length ? ['## Focus', '', ...rows].join('\n') : '';
}
function today(records) {
  const tasks = new Map(records.filter((record) => record.kind === 'task').map((record) => [record.id, record]));
  const entries = new Map();
  records.filter((record) => record.kind === 'task-activity').forEach((record) => {
    const data = record.data || {}; const actions = data.actions || []; const taskId = record.id.replace(/:\d{4}-\d{2}-\d{2}$/, ''); const task = tasks.get(taskId);
    const destination = data.destination || (actions.includes('deferred') ? 'someday' : actions.includes('promoted') ? 'today' : task ? 'today' : '');
    if (!destination || actions.includes('deleted')) return;
    entries.set(taskId, { title: record.title || task?.title || 'Today task', destination, done: data.done === true || data.finalStatus === 'done' || actions.includes('completed') || task?.data?.done === true, at: data.lastAt || record.updatedAt || record.at });
  });
  tasks.forEach((task, id) => { if (!entries.has(id)) entries.set(id, { title: task.title, destination: 'today', done: task.data?.done === true, at: task.at }); });
  const out = ['## Today'];
  for (const [destination, heading] of [['today', 'Added to Today'], ['someday', 'Added to Someday']]) {
    const rows = [...entries.values()].filter((entry) => entry.destination === destination).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    if (!rows.length) continue; out.push('', `### ${heading}`, '');
    rows.forEach((entry) => out.push(entry.done ? `- [x] ${mdText(entry.title)}` : `- [ ] ~~${mdText(entry.title)}~~`));
  }
  return out.length > 1 ? out.join('\n') : '';
}

function folio(records, full) {
  const sessions = records.filter((record) => record.kind === 'reading-session'); const notes = folioNoteRecords(records); if (!sessions.length && !notes.length) return '';
  const out = ['## Folio'];
  if (sessions.length) { out.push(''); sessions.forEach((record) => out.push(sessionLine(record, codeSpan(record.title)))); }
  if (full && notes.length) {
    out.push('', '### Notes');
    folioGroups(notes).forEach((group) => { out.push('', `#### ${mdText(group.title)}`, ''); group.records.forEach((record) => { const data = record.data || {}; out.push(`- ${formatClock(record.at)}${data.locationLabel ? ` · ${mdText(data.locationLabel)}` : ''}`); if (data.quote) out.push('', quote(data.quote), ''); if (data.note) out.push(`  Note: ${mdText(data.note)}`); }); });
  }
  return out.join('\n').trimEnd();
}

function petal(records, full) {
  const out = ['## Petal']; let count = 0;
  petalGroups(records).forEach((book) => {
    book.records.filter((record) => record.kind === 'reading-session').forEach((record) => { const data = record.data || {}; out.push('', sessionLine(record, `*${mdText(book.title)}*`, ` · ${Math.round(Number(data.startProgression || 0) * 100)}% → ${Math.round(Number(data.endProgression || 0) * 100)}%`)); count += 1; });
    if (full) book.records.filter((record) => record.kind !== 'reading-session').forEach((record) => { const data = record.data || {}; out.push('', `- ${formatClock(record.at)} · ${mdText(book.title)} · ${mdText(record.kind.replaceAll('-', ' '))}`); if (data.quote) out.push('', quote(data.quote)); if (data.note) out.push(`  Note: ${mdText(data.note)}`); count += 1; });
  });
  return count ? out.join('\n').trimEnd() : '';
}

function cove(records) {
  const rows = records.filter((record) => record.kind === 'reading-session').map((record) => sessionLine(record, mdText(record.title)));
  return rows.length ? ['## Cove', '', ...rows].join('\n') : '';
}
function tide(records, full) {
  const rows = []; records.filter((record) => record.kind === 'clip' || record.kind === 'dump').forEach((record) => { rows.push(`- ${formatClock(record.at)}`); if (full && record.data?.text) rows.push('', quote(record.data.text), ''); });
  return rows.length ? ['## Tide', '', ...rows].join('\n').trimEnd() : '';
}
function loom(records, full) {
  const blocks = records.filter((record) => record.kind === 'block'); if (!blocks.length) return '';
  const out = ['## Loom', '']; blocks.forEach((record) => { const data = record.data || {}; out.push(`- [${data.done ? 'x' : ' '}] ${rangeFromMinutes(data.start, data.duration)} · ${mdText(record.title)}`); if (full && data.note) out.push(`  - ${mdText(data.note)}`); }); return out.join('\n');
}
function usage(app, records) {
  const rows = records.filter((record) => record.kind === 'usage-session').map((record) => sessionLine(record, codeSpan(record.title)));
  return rows.length ? [`## ${app}`, '', ...rows].join('\n') : '';
}
function quill(records) {
  const rows = records.filter((record) => record.kind === 'file-activity').map((record) => `- ${formatClock(record.data?.lastAt || record.at)} · ${codeSpan(record.title)}`);
  return rows.length ? ['## Quill', '', ...rows].join('\n') : '';
}

export function serializeMarkdown({ day, date, note = '', detail = 'full', snapshotAt = new Date() }) {
  const status = day.cached ? 'cached' : day.failures?.length ? 'partial' : 'complete'; const parsed = new Date(`${date}T12:00:00`); const title = Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const snapshot = snapshotAt instanceof Date ? snapshotAt : new Date(snapshotAt); const snapshotTime = Number.isNaN(snapshot.getTime()) ? '--:--' : snapshot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const sections = [
    focus(day.apps?.focus || []), today(day.apps?.today || []), folio(day.apps?.folio || [], detail === 'full'),
    petal(day.apps?.petal || [], detail === 'full'), cove(day.apps?.cove || []), tide(day.apps?.tide || [], detail === 'full'),
    loom(day.apps?.loom || [], detail === 'full'), quill(day.apps?.quill || []), usage('Slate', day.apps?.slate || []), usage('Grove', day.apps?.grove || []),
    `## Daily note\n\n${safeText(note)}`.trimEnd(),
  ].filter(Boolean);
  return `---\ndate: ${date}\ntime: "${snapshotTime}"\nstatus: ${status}\n---\n\n# ${title}\n\n${sections.join('\n\n')}\n`;
}
