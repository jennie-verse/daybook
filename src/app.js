import { SOURCE_APPS, SOURCE_BY_ID } from './sources.js';
import { fileAppRecords, folioGroups, petalGroups, recordBody, recordMeta, sourceSummary, timeLabel, visibleSections } from './day-model.js';
import { serializeMarkdown } from './markdown.js';
import { backupData, clearStore, getCacheBytes, listItems, readLocalNote, restoreData, saveLocalNote } from './store.js';
import { flushNote, readSourceStatuses, reconcileNote, refreshDay } from './sync.js';

const $ = (id) => document.getElementById(id);
const pad = (value) => String(value).padStart(2, '0');
const localDate = (value = new Date()) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const today = () => localDate();
const read = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* settings remain in memory */ } };
const remove = (key) => { try { localStorage.removeItem(key); } catch { /* already unavailable */ } };
const makeContext = (label) => {
  const slug = String(label || 'daybook').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'daybook';
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 8);
  return `${slug}-${suffix}`;
};
const emptyDay = (date) => ({ date, apps: Object.fromEntries(SOURCE_APPS.map(({ id }) => [id, []])), records: [], failures: [], diagnostics: [], cached: false });
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today();
const rememberedDate = () => { const saved = read('daybook.date', ''); return isDate(saved) ? saved : today(); };
const state = {
  date: rememberedDate(), view: read('daybook.view', 'by-app'), token: read('sync.token.v1'), context: read('daybook.context'),
  textSize: read('daybook.textSize', '12'), markdownDetail: read('daybook.markdownDetail', 'full'), day: null, note: '', markdownSnapshotAt: null, statuses: {}, availability: new Map(), refreshing: false,
};
let noteTimer = null; let composing = false; let toastTimer = null; let lastRemoteRefreshAt = 0; let resumeTimer = null;
const node = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600); }
function updateDateHeader() {
  const date = new Date(`${state.date}T12:00:00`); $('date-weekday').textContent = date.toLocaleDateString('en-US', { weekday: 'long' }); $('date-title').textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); $('date-input').value = state.date; $('date-input').max = today(); $('next-day').disabled = state.date >= today(); $('today-button').hidden = state.date === today(); $('rail-month').textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); renderCalendar(date);
}
function renderCalendar(date) {
  const host = $('mini-calendar'); host.replaceChildren(); ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((day) => host.append(node('span', 'weekday', day)));
  const first = new Date(date.getFullYear(), date.getMonth(), 1); const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  for (let i = 0; i < first.getDay(); i += 1) host.append(node('span', 'blank', ''));
  for (let day = 1; day <= days; day += 1) {
    const button = node('button', 'calendar-day', String(day)); const value = localDate(new Date(date.getFullYear(), date.getMonth(), day)); button.disabled = value > today(); if (value === state.date) button.classList.add('selected'); if (value === today()) button.classList.add('today'); const count = state.availability.get(value) || 0; if (count) { button.classList.add('has-records'); button.title = `${count} app${count === 1 ? '' : 's'} with records`; } button.onclick = () => changeDate(value); host.append(button);
  }
}
function entryNode(record, { timeline = false } = {}) {
  const article = node('article', timeline ? 'timeline-entry' : 'record-row'); const source = SOURCE_BY_ID.get(record.app);
  if (timeline) { const marker = node('div', 'timeline-marker'); marker.append(node('span', 'timeline-time', timeLabel(record.at)), node('span', 'source-dot', source.icon)); article.append(marker); }
  const body = node('div', 'record-content'); const heading = node('div', 'record-heading'); const title = node('strong', '', record.title || source.label); const link = node('a', 'source-link', timeline ? source.label : 'Open'); link.href = source.href; link.textContent = timeline ? source.label : 'Open'; heading.append(title, link);
  const meta = node('p', 'record-meta', recordMeta(record)); body.append(heading, meta);
  const text = recordBody(record);
  if (text) { const details = document.createElement('details'); details.className = 'record-details'; const summary = node('summary', '', timeline ? 'Show source text' : 'Details'); const pre = node('pre', '', text); details.append(summary, pre); body.append(details); }
  article.append(body); return article;
}
function appSection(source, records) {
  const section = node('section', 'source-section'); const heading = node('div', 'section-heading source-heading'); const titleWrap = node('div'); titleWrap.append(node('span', 'section-icon', source.icon), node('h2', '', source.label)); heading.append(titleWrap, node('span', 'summary', sourceSummary(source.id, records))); section.append(heading);
  if (source.id === 'petal') {
    petalGroups(records).forEach((book) => { const group = node('div', 'book-group'); const title = node('h3', '', book.title); if (book.author) title.append(node('span', '', ` — ${book.author}`)); group.append(title); book.records.forEach((record) => group.append(entryNode(record))); section.append(group); });
  } else records.forEach((record) => section.append(entryNode(record)));
  return section;
}
function renderByApp() {
  const fragment = document.createDocumentFragment(); const { regular, files, folioNotes } = visibleSections(state.day);
  regular.forEach((source) => fragment.append(appSection(source, state.day.apps[source.id])));
  if (folioNotes.length) { const section = node('section', 'source-section folio-notes-section'); const heading = node('div', 'section-heading source-heading'); const wrap = node('div'); wrap.append(node('span', 'section-icon', '▧'), node('h2', '', 'Folio notes')); heading.append(wrap, node('span', 'summary', sourceSummary('folio', folioNotes))); section.append(heading); folioGroups(folioNotes).forEach((documentGroup) => { const group = node('div', 'book-group'); group.append(node('h3', '', documentGroup.title)); documentGroup.records.forEach((record) => group.append(entryNode(record))); section.append(group); }); fragment.append(section); }
  if (files.length) { const section = node('section', 'source-section files-section'); const heading = node('div', 'section-heading source-heading'); const wrap = node('div'); wrap.append(node('span', 'section-icon', '▤'), node('h2', '', 'Files worked with')); heading.append(wrap); section.append(heading); files.forEach((source) => { const records = fileAppRecords(source.id, state.day.apps[source.id]); const group = node('div', 'file-group'); const label = node('h3', '', source.label); label.append(node('span', 'summary', ` · ${sourceSummary(source.id, records)}`)); group.append(label); records.forEach((record) => group.append(entryNode(record))); section.append(group); }); fragment.append(section); }
  if (!regular.length && !files.length && !folioNotes.length) { const empty = node('div', 'empty-state'); empty.append(node('span', 'empty-icon', '☁'), node('h2', '', 'No records this day.'), node('p', '', 'Your Daily note is still available below. Included activity will appear after a source app syncs.')); fragment.append(empty); }
  return fragment;
}
function renderTimeline() {
  const fragment = document.createDocumentFragment(); const heading = node('div', 'view-title'); heading.append(node('div', 'eyebrow', 'CHRONOLOGICAL'), node('h2', '', 'Timeline'), node('p', '', `${state.day.records.length} records across ${new Set(state.day.records.map((record) => record.app)).size} apps`)); fragment.append(heading);
  const timeline = node('div', 'timeline'); state.day.records.forEach((record) => timeline.append(entryNode(record, { timeline: true }))); if (!state.day.records.length) timeline.append(node('p', 'empty-inline', 'No records this day.')); fragment.append(timeline); return fragment;
}
function renderMarkdown() {
  const fragment = document.createDocumentFragment(); const heading = node('div', 'view-title markdown-heading'); const top = node('div'); top.append(node('div', 'eyebrow', 'EXPORT'), node('h2', '', 'Markdown')); const segmented = node('div', 'segmented'); const preview = node('button', 'active', 'Preview'); const source = node('button', '', 'Source'); segmented.append(preview, source); heading.append(top, segmented); fragment.append(heading);
  const output = node('div', 'markdown-output preview-mode'); const setMode = (mode) => { preview.classList.toggle('active', mode === 'preview'); source.classList.toggle('active', mode === 'source'); output.classList.toggle('preview-mode', mode === 'preview'); output.replaceChildren(); if (mode === 'source') output.append(node('pre', 'markdown-source', markdown())); else renderSafeMarkdownPreview(output, markdown()); }; preview.onclick = () => setMode('preview'); source.onclick = () => setMode('source'); setMode('preview'); fragment.append(output);
  const actions = node('div', 'markdown-actions'); const copy = node('button', 'primary-button', 'Copy Markdown'); const download = node('button', '', 'Share / Download .md'); copy.onclick = copyMarkdown; download.onclick = downloadMarkdown; actions.append(copy, download); fragment.append(actions); return fragment;
}
function renderSafeMarkdownPreview(host, value) {
  let frontmatter = false;
  value.split('\n').forEach((line) => {
    if (line === '---') { frontmatter = !frontmatter; return; }
    if (frontmatter || !line.trim()) return;
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) { host.append(node(`h${heading[1].length}`, '', heading[2])); return; }
    if (line.startsWith('> ')) { host.append(node('blockquote', '', line.slice(2))); return; }
    const task = line.match(/^- \[([ x])\] (.*)$/i);
    if (task) { const row = node('p', 'preview-task'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.disabled = true; checkbox.checked = task[1].toLowerCase() === 'x'; row.append(checkbox); appendPreviewInline(row, task[2]); host.append(row); return; }
    if (/^- /.test(line)) { const row = node('p', 'preview-list-item', '• '); appendPreviewInline(row, line.slice(2)); host.append(row); return; }
    host.append(node('p', '', line));
  });
}
function appendPreviewInline(host, value) {
  const pattern = /(~~[^~]+~~|`[^`]+`|\*[^*]+\*)/g; let offset = 0;
  for (const match of value.matchAll(pattern)) {
    if (match.index > offset) host.append(document.createTextNode(value.slice(offset, match.index)));
    const token = match[0]; const element = token.startsWith('~~') ? node('del', '', token.slice(2, -2)) : token.startsWith('`') ? node('code', '', token.slice(1, -1)) : node('em', '', token.slice(1, -1)); host.append(element); offset = match.index + token.length;
  }
  if (offset < value.length) host.append(document.createTextNode(value.slice(offset)));
}
function invalidateMarkdownSnapshot() { state.markdownSnapshotAt = null; }
function markdown() { state.markdownSnapshotAt ||= new Date(); return serializeMarkdown({ day: state.day || emptyDay(state.date), date: state.date, note: state.note, detail: state.markdownDetail, snapshotAt: state.markdownSnapshotAt }); }
function render() {
  document.documentElement.style.setProperty('--base-size', `${state.textSize}px`); updateDateHeader(); const host = $('view-host'); host.replaceChildren(state.view === 'timeline' ? renderTimeline() : state.view === 'markdown' ? renderMarkdown() : renderByApp());
  document.querySelectorAll('[data-view]').forEach((button) => { const active = button.dataset.view === state.view; button.setAttribute('aria-selected', String(active)); if (button.closest('.bottom-nav')) active ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current'); });
  const appCount = new Set((state.day?.records || []).map((record) => record.app)).size; $('source-summary').textContent = `${SOURCE_APPS.length} sources · ${appCount} with records`; $('freshness').textContent = state.day?.refreshedAt ? `${appCount} apps · Updated ${timeLabel(state.day.refreshedAt)}` : 'Not refreshed yet';
}
function setBanner() {
  const banner = $('connection-state'); banner.className = 'state-banner'; let text = '';
  if (!state.token) { text = state.day?.cached ? 'Not connected · showing cached data' : 'Connect your private repository in Settings to load journal activity.'; banner.classList.add('warning'); }
  else if (!navigator.onLine) { text = 'Offline · cached data. Daily note changes will sync when you reconnect.'; banner.classList.add('offline'); }
  else if (state.day?.configurationError) { text = state.day.configurationError; banner.classList.add('warning'); }
  else if (state.day?.failures?.length) { text = `Some sources could not be refreshed: ${state.day.failures.map((id) => SOURCE_BY_ID.get(id).label).join(', ')}.`; banner.classList.add('partial'); }
  else if (state.day?.diagnostics?.length) { text = `${state.day.diagnostics.length} source file${state.day.diagnostics.length === 1 ? '' : 's'} could not be read. Other records are available.`; banner.classList.add('partial'); }
  banner.textContent = text; banner.hidden = !text;
}
async function loadDay({ remote = true } = {}) {
  invalidateMarkdownSnapshot();
  if (state.refreshing) return; state.refreshing = true; $('refresh-button').disabled = true; $('freshness').textContent = 'Refreshing…';
  try {
    state.day = await refreshDay(state.date, remote ? state.token : ''); if (remote && state.token) lastRemoteRefreshAt = Date.now(); const cachedDays = await listItems('days'); state.availability = new Map(cachedDays.map((day) => [day.date || day.key, new Set((day.records || []).map((record) => record.app)).size]).filter(([, count]) => count)); const note = remote && state.token ? await reconcileNote(state.date, state.token) : await readLocalNote(state.date); state.note = note?.markdown || ''; $('note-text').value = state.note; $('note-status').textContent = 'Saved on this device'; setBanner(); render();
  } catch { state.day ||= emptyDay(state.date); setBanner(); render(); toast('Cached journal remains available.'); }
  finally { state.refreshing = false; $('refresh-button').disabled = false; }
}
async function changeDate(date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) return; state.date = date; write('daybook.date', date); state.note = ''; $('note-text').value = ''; await loadDay(); }
function shiftDay(amount) { const date = new Date(`${state.date}T12:00:00`); date.setDate(date.getDate() + amount); changeDate(localDate(date)); }
function setView(view) { state.view = view; write('daybook.view', view); render(); }
async function persistNote() {
  state.note = $('note-text').value.normalize('NFC'); invalidateMarkdownSnapshot(); await saveLocalNote(state.date, state.note); $('note-status').textContent = 'Saved on this device · waiting to sync'; clearTimeout(noteTimer); noteTimer = setTimeout(() => flushOutbox(), 4000);
}
/**
 * Push every queued note, not only the day on screen.
 *
 * flushNote() only ever ran for state.date, and nothing else drained the
 * outbox — so a note typed and then navigated away from (or written offline and
 * reopened on another day) stayed on the device for ever while the status line
 * still read "waiting to sync".
 */
async function flushOutbox() {
  if (!state.token || !state.context || !navigator.onLine) return;
  for (const item of await listItems('outbox')) {
    const date = item.date || item.key;
    try { if (await flushNote(date, state.token, state.context) && date === state.date) $('note-status').textContent = 'Synced privately'; }
    catch (error) { if (error?.type === 'configuration' && date === state.date) $('note-status').textContent = 'Saved on this device · sync unavailable on this domain'; /* stays queued for the next attempt */ }
  }
}
async function copyMarkdown() { try { await navigator.clipboard.writeText(markdown()); toast('Markdown copied'); } catch { toast('Copy is unavailable in this browser'); } }
function downloadText(content, name, type) { const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([content], { type })); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
function downloadMarkdown() { downloadText(markdown(), `journal-${state.date}.md`, 'text/markdown;charset=utf-8'); toast('Markdown downloaded'); }
async function renderStatuses() {
  state.statuses = await readSourceStatuses(state.token); const host = $('source-status-list'); host.replaceChildren();
  SOURCE_APPS.forEach((source) => { const status = state.statuses[source.id] || {}; const item = node('div', 'source-status'); item.append(node('span', 'status-dot ' + (status.state || 'not-reported')), node('strong', '', source.label)); const configurationError = status.configurationError; const parts = [configurationError ? 'configuration required' : (status.state || 'not-reported').replace('-', ' ')]; if (status.contextCount) parts.push(`${status.contextCount} context${status.contextCount === 1 ? '' : 's'}`); if (status.mixedContent) parts.push('mixed content settings'); if (status.pendingCount) parts.push(`${status.pendingCount} pending`); const details = node('span', '', parts.join(' · ')); if (configurationError) details.title = configurationError; else if (status.reportedAt) details.title = `Last reported ${new Date(status.reportedAt).toLocaleString()}${status.lastSuccessfulWriteAt ? ` · Last write ${new Date(status.lastSuccessfulWriteAt).toLocaleString()}` : ''}`; const link = node('a', 'text-button', ['quill', 'slate', 'grove'].includes(source.id) && status.state === 'not-reported' ? 'History starts with this version' : 'Open Journal settings'); link.href = source.href; item.append(details, link); host.append(item); });
}
async function openSettings() {
  $('token-input').value = ''; $('token-status').textContent = state.token ? `Saved token ending in ••••${state.token.slice(-4)}` : 'No token saved'; $('context-input').value = read('daybook.contextLabel'); $('text-size').value = state.textSize; $('markdown-detail').value = state.markdownDetail; $('cache-size').textContent = `Activity cache: ${Math.max(1, Math.round((await getCacheBytes()) / 1024))} KB`; await renderStatuses(); $('settings-dialog').showModal();
}
async function saveSettings() {
  const entered = $('token-input').value.trim(); if (entered) { state.token = entered; write('sync.token.v1', entered); } const label = $('context-input').value.trim() || 'daybook'; if (!state.context) state.context = makeContext(label); write('daybook.context', state.context); write('daybook.contextLabel', label); state.textSize = $('text-size').value; state.markdownDetail = $('markdown-detail').value; invalidateMarkdownSnapshot(); write('daybook.textSize', state.textSize); write('daybook.markdownDetail', state.markdownDetail); await loadDay();
}
function bind() {
  $('previous-day').onclick = () => shiftDay(-1); $('next-day').onclick = () => shiftDay(1); $('today-button').onclick = $('rail-today').onclick = () => changeDate(today()); $('date-button').onclick = () => $('date-dialog').showModal(); $('choose-date').onclick = () => changeDate($('date-input').value); $('refresh-button').onclick = () => loadDay(); $('open-settings').onclick = openSettings; $('open-settings-compact').onclick = openSettings; $('settings-refresh').onclick = async () => { await renderStatuses(); toast('Source status refreshed'); }; $('save-settings').onclick = saveSettings;
  document.querySelectorAll('[data-view]').forEach((button) => button.onclick = () => setView(button.dataset.view)); $('copy-markdown').onclick = copyMarkdown; $('download-markdown').onclick = downloadMarkdown;
  $('note-text').addEventListener('compositionstart', () => { composing = true; }); $('note-text').addEventListener('compositionend', () => { composing = false; persistNote(); }); $('note-text').addEventListener('input', () => { if (!composing) persistNote(); });
  $('remove-token').onclick = () => { state.token = ''; remove('sync.token.v1'); $('token-status').textContent = 'No token saved'; $('token-input').value = ''; toast('Token removed from this device'); };
  $('clear-cache').onclick = async () => { await clearStore('days'); $('cache-size').textContent = 'Activity cache: cleared'; toast('Activity cache cleared'); };
  $('download-backup').onclick = async () => downloadText(JSON.stringify(await backupData(state), null, 2), `daybook-backup-${today()}.json`, 'application/json');
  $('restore-backup').onchange = async (event) => { try { const settings = await restoreData(JSON.parse(await event.target.files[0].text())); if (settings.textSize) state.textSize = settings.textSize; if (settings.markdownDetail) state.markdownDetail = settings.markdownDetail; toast('Backup restored'); await loadDay({ remote: false }); } catch { toast('This is not a valid Daybook backup'); } };
  window.addEventListener('online', async () => { setBanner(); await flushOutbox(); await loadDay(); }); window.addEventListener('offline', () => { setBanner(); render(); });
  const refreshOnResume = () => { if (document.visibilityState === 'hidden' || Date.now() - lastRemoteRefreshAt <= 60_000) return; clearTimeout(resumeTimer); resumeTimer = setTimeout(() => loadDay(), 250); };
  window.addEventListener('pageshow', refreshOnResume); document.addEventListener('visibilitychange', refreshOnResume);
}
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return; try { const registration = await navigator.serviceWorker.register('./sw.js'); if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' }); registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', () => { if (registration.waiting) toast('Daybook update ready'); })); } catch { /* app remains usable online */ }
}
state.day = emptyDay(state.date); bind(); render(); loadDay().then(flushOutbox); registerServiceWorker();
