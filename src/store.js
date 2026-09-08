const DB_NAME = 'daybook-db'; const DB_VERSION = 1; const STORES = ['sourceFiles', 'days', 'notes', 'noteConflicts', 'outbox', 'settings'];
function openDb() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onupgradeneeded = () => STORES.forEach((name) => { if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'key' }); }); request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); dbPromise = null; }; db.onclose = () => { dbPromise = null; }; resolve(db); }; request.onerror = () => reject(request.error); }); }
// One connection, reused. Opening and closing the database per operation cost
// two full open() round trips per keystroke in the Daily note, because every
// keystroke writes both the note and its outbox entry.
let dbPromise = null;
function connection() { return dbPromise ||= openDb().catch((error) => { dbPromise = null; throw error; }); }
async function transact(storeNames, mode, operation) {
  const db = await connection();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let request;
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Storage write failed'));
    try { request = operation(transaction.objectStore([].concat(storeNames)[0]), transaction); }
    catch (error) { transaction.abort(); reject(error); }
  });
}
export const getItem = (store, key) => transact(store, 'readonly', (objectStore) => objectStore.get(key));
export const putItem = (store, item) => transact(store, 'readwrite', (objectStore) => objectStore.put(structuredClone(item)));
export const deleteItem = (store, key) => transact(store, 'readwrite', (objectStore) => objectStore.delete(key));
export const listItems = (store) => transact(store, 'readonly', (objectStore) => objectStore.getAll());
export const clearStore = (store) => transact(store, 'readwrite', (objectStore) => objectStore.clear());
export async function cacheDay(date, day) { await putItem('days', { key: date, ...structuredClone(day), cachedAt: new Date().toISOString() }); }
export async function readCachedDay(date) { return getItem('days', date); }
export async function saveLocalNote(date, markdown, updatedAt = new Date().toISOString()) {
  const item = { key: date, date, markdown, updatedAt };
  await transact(['notes', 'outbox'], 'readwrite', (notes, transaction) => {
    notes.put(item); return transaction.objectStore('outbox').put(item);
  });
  return item;
}
// A completed upload may only acknowledge the exact note it sent. A newer
// edit made during the request must remain queued for the next upload.
export async function acknowledgeNote(date, uploaded) {
  let acknowledged = false;
  await transact('outbox', 'readwrite', (outbox) => {
    const request = outbox.get(date);
    request.onsuccess = () => {
      const pending = request.result;
      if (pending?.updatedAt === uploaded.updatedAt && pending.markdown === uploaded.markdown) {
        outbox.delete(date); acknowledged = true;
      }
    };
    return request;
  });
  return acknowledged;
}
export async function mergeRemoteNote(date, remote) {
  let result;
  await transact(['notes', 'noteConflicts', 'outbox'], 'readwrite', (notes, transaction) => {
    const request = notes.get(date);
    request.onsuccess = () => {
      const local = request.result;
      const remoteWins = !local || Date.parse(remote.updatedAt) > Date.parse(local.updatedAt);
      const loser = remoteWins ? local : remote;
      if (loser && local?.markdown !== remote.markdown) transaction.objectStore('noteConflicts').put({
        ...loser, date, key: `${date}:${loser.updatedAt || Date.now()}`,
      });
      result = remoteWins ? { key: date, date, markdown: remote.markdown, updatedAt: remote.updatedAt } : local;
      if (remoteWins) { notes.put(result); transaction.objectStore('outbox').delete(date); }
    };
    return request;
  });
  return result;
}
export async function readLocalNote(date) { return getItem('notes', date); }
export async function preserveConflict(date, item) { return putItem('noteConflicts', { ...item, key: `${date}:${item.updatedAt || Date.now()}` }); }
export async function getCacheBytes() { return new TextEncoder().encode(JSON.stringify([await listItems('days'), await listItems('sourceFiles')])).byteLength; }
export async function backupData(settings) { return { v: 1, app: 'daybook', exportedAt: new Date().toISOString(), settings: { textSize: settings.textSize, markdownDetail: settings.markdownDetail, markdownLayout: settings.markdownLayout, context: settings.context }, notes: await listItems('notes') }; }
export async function restoreData(payload) {
  if (payload?.v !== 1 || payload?.app !== 'daybook' || !Array.isArray(payload.notes)) throw new Error('Invalid Daybook backup');
  const dates = new Set();
  const updatedAt = new Date().toISOString();
  const notes = payload.notes.map((note) => {
    if (!note || typeof note.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(note.date)
      || !Number.isFinite(Date.parse(`${note.date}T00:00:00Z`))
      || new Date(`${note.date}T00:00:00Z`).toISOString().slice(0, 10) !== note.date
      || dates.has(note.date) || typeof note.markdown !== 'string') throw new Error('Invalid Daybook note');
    dates.add(note.date);
    return { key: note.date, date: note.date, markdown: note.markdown, updatedAt };
  });
  await transact(['notes', 'outbox'], 'readwrite', (store, transaction) => {
    for (const note of notes) { store.put(note); transaction.objectStore('outbox').put(note); }
  });
  const settings = {};
  if ([6, 8, 10, 12, 14, 17].includes(Number(payload.settings?.textSize))) settings.textSize = String(payload.settings.textSize);
  if (['full', 'compact'].includes(payload.settings?.markdownDetail)) settings.markdownDetail = payload.settings.markdownDetail;
  if (['chronological', 'by-app'].includes(payload.settings?.markdownLayout)) settings.markdownLayout = payload.settings.markdownLayout;
  return settings;
}
