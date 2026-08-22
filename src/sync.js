import { SOURCE_APPS } from './sources.js';
import { mergeSourceResults } from './merge.js';
import { cacheDay, deleteItem, getItem, preserveConflict, putItem, readCachedDay } from './store.js';
import { webappDataConfig } from './deployment.js';
const config = (token) => webappDataConfig(token);
let modulesPromise;
const modules = () => modulesPromise ||= Promise.all([import('../../shared/v1/sync.js'), import('../../shared/v2/journal.js')]).then(([v1, journal]) => ({ v1, journal }));
export async function refreshDay(date, token) {
  const cached = await readCachedDay(date);
  if (!token) return { ...(cached || { date, apps: Object.fromEntries(SOURCE_APPS.map(({ id }) => [id, []])), records: [] }), failures: SOURCE_APPS.map(({ id }) => id), cached: Boolean(cached), needsToken: true };
  let repoConfig;
  try { repoConfig = config(token); }
  catch (error) {
    if (error?.type !== 'configuration') throw error;
    return { ...(cached || { date, apps: Object.fromEntries(SOURCE_APPS.map(({ id }) => [id, []])), records: [] }), failures: SOURCE_APPS.map(({ id }) => id), cached: Boolean(cached), configurationError: error.message };
  }
  const { journal } = await modules();
  const results = await Promise.all(SOURCE_APPS.map(async ({ id: app }) => { try { return await journal.readDate({ config: repoConfig, app, date }); } catch (error) { return { app, date, records: [], diagnostics: [], error }; } }));
  const merged = mergeSourceResults(results, cached); const day = { date, ...merged, cached: merged.failures.length > 0 && Boolean(cached), refreshedAt: new Date().toISOString() }; await cacheDay(date, day); return day;
}
export async function readSourceStatuses(token) {
  if (!token) return Object.fromEntries(SOURCE_APPS.map(({ id }) => [id, { state: 'not-reported' }]));
  let repoConfig;
  try { repoConfig = config(token); }
  catch (error) {
    if (error?.type !== 'configuration') throw error;
    return Object.fromEntries(SOURCE_APPS.map(({ id }) => [id, { state: 'error', configurationError: error.message }]));
  }
  const { v1 } = await modules();
  return Object.fromEntries(await Promise.all(SOURCE_APPS.map(async ({ id: app }) => {
    try {
      const entries = await v1.listDir(repoConfig, `journal/status/${app}`); if (!entries.length) return [app, { state: 'not-reported' }]; const reports = [];
      for (const entry of entries.filter((item) => item.type === 'file' && item.name.endsWith('.json'))) { try { const file = await v1.readFile(repoConfig, entry.path); if (file.exists) reports.push(JSON.parse(file.content)); } catch { /* retain other reports */ } }
      reports.sort((a, b) => Date.parse(b.reportedAt || 0) - Date.parse(a.reportedAt || 0)); const latest = reports[0]; if (!latest) return [app, { state: 'error' }];
      return [app, { ...latest, state: latest.journalEnabled === false ? 'disabled' : latest.lastErrorCode ? 'error' : Number(latest.pendingCount) > 0 ? 'pending' : 'ready' }];
    } catch { return [app, { state: 'error' }]; }
  })));
}
export async function readRemoteNote(date, token) {
  if (!token) return null; const { v1 } = await modules(); const entries = await v1.listDir(config(token), `journal/notes/${date.slice(0, 7)}`); const matches = entries.filter((entry) => entry.type === 'file' && entry.name.startsWith(`${date}.`) && entry.name.endsWith('.json')); const notes = [];
  for (const entry of matches) { try { const file = await v1.readFile(config(token), entry.path); const parsed = JSON.parse(file.content); if (parsed?.v === 1 && parsed.date === date && typeof parsed.markdown === 'string') notes.push({ ...parsed, path: entry.path, sha: file.sha }); } catch { /* ignore invalid content */ } }
  notes.sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0) || b.path.localeCompare(a.path)); return notes[0] || null;
}
export async function reconcileNote(date, token) {
  const local = await getItem('notes', date); let remote = null; try { remote = await readRemoteNote(date, token); } catch { return local; } if (!remote) return local;
  if (!local || Date.parse(remote.updatedAt) > Date.parse(local.updatedAt)) { if (local?.markdown && local.markdown !== remote.markdown) await preserveConflict(date, local); const item = { key: date, date, markdown: remote.markdown, updatedAt: remote.updatedAt }; await putItem('notes', item); return item; }
  if (local.markdown !== remote.markdown) await preserveConflict(date, remote); return local;
}
export async function flushNote(date, token, context) {
  const pending = await getItem('outbox', date); if (!pending || !token || !context || !navigator.onLine) return false; const { v1, journal } = await modules(); const path = journal.notePath(date, context);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { const current = await v1.readFile(config(token), path); let existing = null; try { existing = current.exists ? JSON.parse(current.content) : null; } catch { existing = null; } if (existing?.markdown && existing.markdown !== pending.markdown && Date.parse(existing.updatedAt || 0) > Date.parse(pending.updatedAt)) await preserveConflict(date, { ...existing, date }); const body = `${JSON.stringify({ v: 1, context, date, updatedAt: pending.updatedAt, markdown: pending.markdown }, null, 2)}\n`; await v1.writeFile(config(token), path, body, { ...(current.sha ? { sha: current.sha } : {}), message: `journal: update daily note ${date}` }); await deleteItem('outbox', date); return true; } catch (error) { if (error?.type !== 'conflict' || attempt === 3) throw error; }
  }
  return false;
}
