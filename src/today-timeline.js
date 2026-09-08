// Read-only adapter. Today owns the records; Daybook never writes its database or sync files.
import { getItem, putItem } from './store.js';
const ROOT = 'today/timeline';
const model = () => import('../../today/src/timeline-model.js');
export function readLocalTimeline() {
  if (typeof indexedDB === 'undefined') return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    let absent = false;
    const request = indexedDB.open('today-db');
    request.onupgradeneeded = () => { absent = true; request.transaction.abort(); };
    request.onerror = () => absent ? resolve([]) : reject(request.error);
    request.onblocked = () => reject(new Error('Close an older Today tab and refresh.'));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('timelineEntries')) { db.close(); resolve([]); return; }
      const tx = db.transaction(['timelineEntries', 'timelineConflicts'], 'readonly');
      const a = tx.objectStore('timelineEntries').getAll(), b = tx.objectStore('timelineConflicts').getAll();
      tx.oncomplete = () => { db.close(); resolve([...a.result, ...b.result].map(({ runningKey, ...r }) => r)); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Today could not be read.')); };
    };
  });
}
export function projectTimeline(entries, conflicts, date) {
  const conflictIds = new Set(conflicts.map(r => r.id));
  return entries.filter(r => !r.deletedAt && r.startDate === date).map(r => ({
    app: 'today', kind: 'timeline-entry', id: `timeline:${r.id}`, title: r.title,
    date: r.startDate, at: r.startedAt, updatedAt: r.updatedAt,
    data: { startedAt: r.startedAt, endedAt: r.endedAt, timeZone: r.timeZone, isRunning: r.isRunning, conflict: conflictIds.has(r.id) },
  }));
}
async function collectTimeline(date, { config, api, local = readLocalTimeline, readCache = key => getItem('sourceFiles', key), saveCache = item => putItem('sourceFiles', item), getModel = model } = {}) {
  const key = 'today-timeline';
  const cached = await readCache(key);
  let rows = cached?.rows || [], files = { ...(cached?.files || {}) };
  const errors = [];
  try { rows = [...rows, ...await local()]; } catch (error) { errors.push(error.message); }
  let contract;
  try { if (rows.length || config) contract = await getModel(); } catch { errors.push('Today Timeline reader is unavailable. Open Today online, then refresh.'); }
  if (config && contract) {
    try {
      const dirs = await api.listDir(config, ROOT);
      for (const dir of dirs.filter(d => d.type === 'dir' && /^\d{4}-\d{2}$/.test(d.name))) {
        try {
          const entries = await api.listDir(config, `${ROOT}/${dir.name}`);
          for (const entry of entries.filter(f => f.type === 'file' && /^data\.[a-z0-9-]+\.json$/i.test(f.name))) {
            const path = `${ROOT}/${dir.name}/${entry.name}`;
            try {
              if (entry.sha && files[path]?.sha === entry.sha) { rows.push(...files[path].rows); continue; }
              const file = await api.readFile(config, path);
              if (!file.exists) throw new Error('Timeline file changed during refresh.');
              const data = JSON.parse(file.content);
              if (data.v !== 1 || data.app !== 'today-timeline' || data.bucket !== dir.name || data.context !== entry.name.slice(5, -5)) throw new Error('Unsupported Timeline file.');
              contract.validateCollection(data.entries); contract.validateCollection(data.conflicts, { uniqueIds: false });
              const incoming = [...data.entries, ...data.conflicts];
              if (incoming.some(r => r.bucket !== dir.name)) throw new Error('Invalid Timeline month.');
              // Validate against known revisions before accepting a file or its SHA.
              contract.mergeEntries(rows, incoming);
              rows.push(...incoming); files[path] = { sha: file.sha, rows: incoming };
            } catch (error) { errors.push(`${path}: ${error.message}`); }
          }
        } catch (error) { errors.push(`${dir.name}: ${error.message}`); }
      }
    } catch (error) { errors.push(error.message || 'Timeline refresh failed.'); }
  }
  if (!contract) return { records: projectTimeline(cached?.entries || [], cached?.conflicts || [], date), errors };
  try {
    const merged = contract.mergeEntries(rows);
    const records = projectTimeline(merged.entries, merged.conflicts, date);
    try { await saveCache({ key, ...merged, rows: [...merged.entries, ...merged.conflicts], files }); }
    catch { errors.push('Timeline was read but could not be cached on this device.'); }
    return { records, errors };
  } catch (error) { return { records: projectTimeline(cached?.entries || [], cached?.conflicts || [], date), errors: [...errors, error.message] }; }
}

// Serialize cache updates when a date change overlaps a background refresh.
let pending = Promise.resolve();
export function readTodayTimeline(date, options) {
  const result = pending.then(() => collectTimeline(date, options));
  pending = result.catch(() => {});
  return result;
}
