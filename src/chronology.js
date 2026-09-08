import { actionLabel, recordBody, safeText } from './day-model.js';
import { SOURCE_BY_ID } from './sources.js';
const valid = value => typeof value === 'string' && /T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const sessionKinds = new Set(['session', 'reading-session', 'usage-session']);
export const currentZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export function clockAt(iso, zone = currentZone(), date = '') {
  if (!valid(iso)) return 'Time unknown';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(iso)).map(p => [p.type,p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`, h = Number(parts.hour);
  return `${date && day !== date ? `${day} ` : ''}${String(h % 12 || 12).padStart(2,'0')}:${parts.minute} ${h < 12 ? 'AM' : 'PM'}`;
}
export function chronologyRows(day) {
  const records = (day.records || Object.values(day.apps || {}).flat()).filter(r => !r.deleted && !r.deletedAt);
  const activities = new Set(records.filter(r => r.app === 'today' && r.kind === 'task-activity').map(r => r.id.replace(/:\d{4}-\d{2}-\d{2}$/, '')));
  const seen = new Map();
  for (const r of records) {
    const key = `${r.app}:${r.id}`; const previous = seen.get(key);
    if (!previous || Date.parse(r.updatedAt || r.at) > Date.parse(previous.updatedAt || previous.at)) seen.set(key,r);
  }
  return [...seen.values()].filter(r => !(r.app === 'today' && r.kind === 'task' && activities.has(r.id))).map(record => {
    const d = record.data || {}, timeline = record.kind === 'timeline-entry', session = sessionKinds.has(record.kind);
    const scheduled = record.kind === 'block' || (record.app === 'today' && record.kind === 'task');
    let start = timeline || session ? d.startedAt : record.kind.endsWith('-activity') ? d.lastAt || record.at : record.at;
    // A task snapshot represents a plan/status, not evidence that the task happened at its scheduled time.
    if (scheduled) start = null;
    const end = (timeline || session) && valid(d.endedAt) && valid(start) && Date.parse(d.endedAt) >= Date.parse(start) ? d.endedAt : null;
    if (!valid(start)) start = null;
    const label = SOURCE_BY_ID.get(record.app)?.label || record.app || 'Unknown app';
    let description = timeline ? record.title : record.app === 'focus' ? d.subject || d.task || record.title || label : record.title || label;
    let meaning = '';
    if (record.kind.endsWith('-activity')) meaning = `Activity summary${d.actions?.length ? `: ${d.actions.map(actionLabel).join(', ')}` : ''}`;
    else if (scheduled) meaning = 'Planned / task status';
    else if (session) meaning = record.app === 'focus' && d.mode === 'break' ? 'Break' : record.kind === 'reading-session' ? 'Reading' : 'Session';
    else if (!timeline) meaning = record.kind.replaceAll('-', ' ');
    if (timeline && d.isRunning) meaning = 'In progress';
    if (d.historyAccuracy === 'approximate') meaning += `${meaning ? ' · ' : ''}Approximate`;
    if (d.conflict) meaning += `${meaning ? ' · ' : ''}Conflicting edits — review in Today`;
    const body = [recordBody(record), ...(['cove'].includes(record.app) ? [d.quote, d.note] : [])].filter(Boolean).join('\n');
    return { record, id:`${record.app}:${record.id}`, start, end, scheduled, label, description:safeText(description), meaning, body };
  }).sort((a,b) => (a.start ? Date.parse(a.start) : Infinity) - (b.start ? Date.parse(b.start) : Infinity) || a.id.localeCompare(b.id));
}
export function rowTime(row, zone, date) {
  if (!row.start) return row.scheduled ? 'No activity time' : 'Time unknown';
  const offset = iso => new Intl.DateTimeFormat('en', {timeZone:zone, timeZoneName:'shortOffset'}).formatToParts(new Date(iso)).find(p=>p.type==='timeZoneName').value;
  const around = [-12,12].map(h=>offset(new Date(Date.parse(row.start)+h*3600000).toISOString()));
  const showOffset = around[0] !== around[1] || (row.end && offset(row.start) !== offset(row.end));
  const label = iso => `${clockAt(iso,zone,date)}${showOffset ? ` (${offset(iso)})` : ''}`;
  return `${label(row.start)}${row.end ? ` - ${label(row.end)}` : ''}`;
}
const escape = value => safeText(value).replace(/[\r\n]+/g,' ').replace(/([\\`*_[\]{}<>~])/g,'\\$1');
export function chronologicalMarkdown(day, date, { detail = 'full', timeZone = currentZone() } = {}) {
  const rows = chronologyRows(day), timed = rows.filter(r=>r.start), untimed=rows.filter(r=>!r.start);
  const lines = ['## Timeline', '', `Time zone: ${timeZone}`, ''];
  const add = row => {
    const title = escape(row.description), suffix = row.meaning ? ` · ${escape(row.meaning)}` : '';
    lines.push(`${rowTime(row,timeZone,date)} [${escape(row.label)}]${title ? ` ${title}` : ''}${suffix}  `);
    if ((detail === 'full' || row.record.app === 'clip') && row.body) lines.push(...safeText(row.body).split('\n').map(l=>`> ${escape(l)}`), '');
  };
  timed.forEach(add);
  if (!timed.length) lines.push('No timed records this day.');
  if (untimed.length) { lines.push('', '### Without an activity time', ''); untimed.forEach(add); }
  return lines.join('\n').trimEnd();
}
