import { FILE_APPS, SOURCE_APPS } from './sources.js';
import { appIdsWithRecords } from './merge.js';
import { petalGroups, safeText } from './day-model.js';
const mdText = (value) => safeText(value).replace(/([\\`*_[\]{}<>#+.!|~-])/g, '\\$1');
const quote = (value) => safeText(value).split('\n').map((line) => `> ${line}`).join('\n');
const time = (iso) => safeText(iso).slice(11, 16);
const clock = (mins) => `${String(Math.floor(Number(mins || 0) / 60)).padStart(2, '0')}:${String(Number(mins || 0) % 60).padStart(2, '0')}`;
const duration = (seconds) => Math.max(0, Math.round(Number(seconds || 0) / 60));
const codeSpan = (value) => { const body = safeText(value); const ticks = Math.max(1, ...(body.match(/`+/g) || []).map((match) => match.length + 1)); const fence = '`'.repeat(ticks); return `${fence}${body}${fence}`; };
const actionLabel = (value) => ({ created: 'Created', added: 'Added', opened: 'Opened', read: 'Read', edited: 'Edited', 'export-requested': 'Export requested' }[value] || value);
function tide(records, full) {
  const out = ['## Tide'];
  for (const kind of ['clip', 'dump']) {
    const items = records.filter((record) => record.kind === kind); if (!items.length) continue;
    out.push('', `### ${kind === 'clip' ? 'Clips' : 'Dump'}`, '');
    items.forEach((record) => { out.push(`- ${time(record.at)}${record.data?.label ? ` · **${mdText(record.data.label)}**` : ''}${record.data?.type ? ` · ${mdText(record.data.type)}` : ''}`); if (full && record.data?.text) out.push('', quote(record.data.text), ''); });
  }
  return out.join('\n').trimEnd();
}
function focus(records) {
  return ['## Focus', '', ...records.map((record) => { const data = record.data || {}; const details = [data.subject && `  - Subject: ${mdText(data.subject)}`, data.task && `  - Task: ${mdText(data.task)}`].filter(Boolean); return [`- ${time(data.startedAt)}–${time(data.endedAt)} · **${mdText(record.title)}** · ${duration(data.elapsedSeconds)}m${data.plannedSeconds ? ` / planned ${duration(data.plannedSeconds)}m` : ''} · ${data.completed ? 'Completed' : 'Stopped'}`, ...details].join('\n'); })].join('\n');
}
function loom(records, full) {
  return ['## Loom', '', ...records.map((record) => { const data = record.data || {}; const lines = [`- [${data.done ? 'x' : ' '}] ${clock(data.start)}–${clock(Number(data.start || 0) + Number(data.duration || 0))} · **${mdText(record.title)}**`]; if (data.subtitle) lines.push(`  - Subtitle: ${mdText(data.subtitle)}`); if (full && data.note) lines.push(`  - Note: ${mdText(data.note)}`); if (full && data.detail) lines.push(`  - Detail: ${mdText(data.detail)}`); return lines.join('\n'); })].join('\n');
}
function petal(records, full) {
  const out = ['## Petal'];
  petalGroups(records).forEach((book) => { out.push('', `### ${mdText(book.title)}${book.author ? ` — ${mdText(book.author)}` : ''}`, ''); book.records.forEach((record) => { const data = record.data || {}; if (record.kind === 'reading-session') out.push(`- Read ${Math.round(Number(data.startProgression || 0) * 100)}% → ${Math.round(Number(data.endProgression || 0) * 100)}% · ${duration(data.activeSeconds)}m active${data.chapterLabel ? ` · ${mdText(data.chapterLabel)}` : ''}`); else { out.push(`- ${mdText(record.kind.replaceAll('-', ' '))} · ${time(record.at)}`); if (full && data.quote) out.push('', quote(data.quote), ''); if (full && data.note) out.push(`  Note: ${mdText(data.note)}`); if (full && data.definition) out.push(`  Definition: ${mdText(data.definition)}`); } }); });
  return out.join('\n').trimEnd();
}
function fileSections(day) {
  const out = ['## Files worked with'];
  SOURCE_APPS.filter(({ id }) => FILE_APPS.includes(id) && day.apps?.[id]?.length).forEach((source) => { out.push('', `### ${source.label}`, ''); day.apps[source.id].forEach((record) => out.push(`- ${codeSpan(record.title)} · ${(record.data?.actions || []).map(actionLabel).join(', ')}`)); });
  return out.join('\n');
}
export function serializeMarkdown({ day, date, note = '', detail = 'full', timezone = Intl.DateTimeFormat().resolvedOptions().timeZone }) {
  const apps = appIdsWithRecords(day); const status = day.cached ? 'cached' : day.failures?.length ? 'partial' : 'complete'; const parsed = new Date(`${date}T12:00:00`); const title = Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const front = ['---', `date: ${date}`, ...(timezone ? [`timezone: ${timezone}`] : []), 'apps:', ...apps.map((app) => `  - ${app}`), `status: ${status}`, '---']; const sections = [];
  if (day.apps?.tide?.length) sections.push(tide(day.apps.tide, detail === 'full'));
  if (day.apps?.focus?.length) sections.push(focus(day.apps.focus));
  if (day.apps?.loom?.length) sections.push(loom(day.apps.loom, detail === 'full'));
  if (day.apps?.petal?.length) sections.push(petal(day.apps.petal, detail === 'full'));
  if (FILE_APPS.some((app) => day.apps?.[app]?.length)) sections.push(fileSections(day));
  sections.push(`## Daily note\n\n${safeText(note)}`.trimEnd());
  return `${front.join('\n')}\n\n# ${title}\n\n${sections.join('\n\n')}\n`;
}
