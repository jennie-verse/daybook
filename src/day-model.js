import { FILE_APPS, SOURCE_APPS } from './sources.js';
export const safeText = (value) => String(value ?? '').normalize('NFC');
export const timeLabel = (iso) => { const parsed = new Date(iso); return Number.isNaN(parsed.getTime()) ? '--:--' : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
const minutes = (seconds) => Math.max(0, Math.round(Number(seconds || 0) / 60));
const clockFromMinutes = (value) => `${String(Math.floor(Number(value || 0) / 60)).padStart(2, '0')}:${String(Number(value || 0) % 60).padStart(2, '0')}`;
const actionLabel = (action) => ({ created: 'Created', added: 'Added', opened: 'Opened', read: 'Read', edited: 'Edited', 'export-requested': 'Export requested' }[action] || action);
export function sourceSummary(app, records) {
  if (app === 'tide') return `${records.filter((r) => r.kind === 'clip').length} clips · ${records.filter((r) => r.kind === 'dump').length} dumps`;
  if (app === 'focus') { const focus = records.filter((r) => r.data?.mode === 'focus'); return `${focus.length} focus · ${records.length - focus.length} breaks · ${minutes(focus.reduce((sum, r) => sum + Number(r.data?.elapsedSeconds || 0), 0))}m`; }
  if (app === 'loom') return `${records.length} blocks · ${records.filter((r) => r.data?.done).length} done`;
  if (app === 'petal') return `${new Set(records.map((r) => r.data?.bookId).filter(Boolean)).size} books · ${records.length} activities`;
  return `${records.length} item${records.length === 1 ? '' : 's'}`;
}
export function recordMeta(record) {
  const data = record.data || {};
  if (record.app === 'tide') return [data.label, data.type].filter(Boolean).join(' · ');
  if (record.app === 'focus') return `${minutes(data.elapsedSeconds)}m${data.plannedSeconds ? ` / planned ${minutes(data.plannedSeconds)}m` : ''} · ${data.completed ? 'Completed' : 'Stopped'}`;
  if (record.app === 'loom') return `${clockFromMinutes(data.start)}–${clockFromMinutes(Number(data.start || 0) + Number(data.duration || 0))} · ${data.done ? 'Done' : 'Not done'}`;
  if (record.app === 'petal') { if (record.kind === 'reading-session') return `${Math.round(Number(data.startProgression || 0) * 100)}% → ${Math.round(Number(data.endProgression || 0) * 100)}% · ${minutes(data.activeSeconds)}m active`; return record.kind.replaceAll('-', ' '); }
  return (data.actions || []).map(actionLabel).join(', ');
}
export function recordBody(record) {
  const data = record.data || {};
  if (record.app === 'tide') return safeText(data.text || '');
  if (record.app === 'focus') return [data.subject && `Subject: ${data.subject}`, data.task && `Task: ${data.task}`].filter(Boolean).join('\n');
  if (record.app === 'loom') return [data.subtitle, data.note, data.detail].filter(Boolean).join('\n');
  if (record.app === 'petal') return [data.author, data.chapterLabel, data.quote, data.note, data.definition, data.example, data.sentence, data.koreanNote].filter(Boolean).join('\n');
  return '';
}
export function petalGroups(records) {
  const groups = new Map();
  records.forEach((record) => { const key = record.data?.bookId || record.title; if (!groups.has(key)) groups.set(key, { title: record.data?.bookTitle || record.title, author: record.data?.author || '', records: [] }); groups.get(key).records.push(record); });
  return [...groups.values()];
}
export function visibleSections(day) { return { regular: SOURCE_APPS.filter(({ id }) => !FILE_APPS.includes(id) && day.apps?.[id]?.length), files: SOURCE_APPS.filter(({ id }) => FILE_APPS.includes(id) && day.apps?.[id]?.length) }; }
