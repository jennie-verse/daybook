const DB_NAME = 'daybook-db'; const DB_VERSION = 1; const STORES = ['sourceFiles', 'days', 'notes', 'noteConflicts', 'outbox', 'settings'];
function openDb() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onupgradeneeded = () => STORES.forEach((name) => { if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'key' }); }); request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); dbPromise = null; }; db.onclose = () => { dbPromise = null; }; resolve(db); }; request.onerror = () => reject(request.error); }); }
// One connection, reused. Opening and closing the database per operation cost
// two full open() round trips per keystroke in the Daily note, because every
// keystroke writes both the note and its outbox entry.
let dbPromise = null;
function connection() { return dbPromise ||= openDb().catch((error) => { dbPromise = null; throw error; }); }
async function transact(storeName, mode, operation) { const db = await connection(); return new Promise((resolve, reject) => { const request = operation(db.transaction(storeName, mode).objectStore(storeName)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
export const getItem = (store, key) => transact(store, 'readonly', (objectStore) => objectStore.get(key));
export const putItem = (store, item) => transact(store, 'readwrite', (objectStore) => objectStore.put(structuredClone(item)));
export const deleteItem = (store, key) => transact(store, 'readwrite', (objectStore) => objectStore.delete(key));
export const listItems = (store) => transact(store, 'readonly', (objectStore) => objectStore.getAll());
export const clearStore = (store) => transact(store, 'readwrite', (objectStore) => objectStore.clear());
export async function cacheDay(date, day) { await putItem('days', { key: date, ...structuredClone(day), cachedAt: new Date().toISOString() }); }
export async function readCachedDay(date) { return getItem('days', date); }
export async function saveLocalNote(date, markdown, updatedAt = new Date().toISOString()) { const item = { key: date, date, markdown, updatedAt }; await putItem('notes', item); await putItem('outbox', item); return item; }
export async function readLocalNote(date) { return getItem('notes', date); }
export async function preserveConflict(date, item) { return putItem('noteConflicts', { ...item, key: `${date}:${item.updatedAt || Date.now()}` }); }
export async function getCacheBytes() { return new TextEncoder().encode(JSON.stringify(await listItems('days'))).byteLength; }
export async function backupData(settings) { return { v: 1, app: 'daybook', exportedAt: new Date().toISOString(), settings: { textSize: settings.textSize, markdownDetail: settings.markdownDetail, context: settings.context }, notes: await listItems('notes') }; }
export async function restoreData(payload) { if (payload?.v !== 1 || payload?.app !== 'daybook' || !Array.isArray(payload.notes)) throw new Error('Invalid Daybook backup'); for (const note of payload.notes) if (/^\d{4}-\d{2}-\d{2}$/.test(note.date) && typeof note.markdown === 'string') await putItem('notes', { key: note.date, date: note.date, markdown: note.markdown, updatedAt: note.updatedAt || new Date().toISOString() }); return payload.settings || {}; }
