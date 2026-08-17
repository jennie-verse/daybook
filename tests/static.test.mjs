import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
test('PWA contains the production shell and approved icon assets', () => {
  for (const file of ['index.html', 'assets/app.css', 'src/app.js', 'src/store.js', 'src/sync.js', 'src/markdown.js', 'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']) assert.ok(existsSync(join(root, file)), file);
  assert.match(read('index.html'), /By app/); assert.match(read('index.html'), /Timeline/); assert.match(read('index.html'), /Markdown/); assert.match(read('index.html'), /Daily note/);
});
test('only the eight approved sources are registered', async () => {
  const { SOURCE_APPS } = await import('../src/sources.js'); assert.deepEqual(SOURCE_APPS.map(({ id }) => id), ['tide', 'focus', 'loom', 'petal', 'folio', 'quill', 'slate', 'grove']);
  for (const excluded of ['vault', 'trace', 'atlas', 'shared']) assert.ok(!SOURCE_APPS.some(({ id }) => id === excluded));
});
test('central reader uses journal projections and no foreign app storage', () => {
  const sync = read('src/sync.js'); assert.match(sync, /journal\.readDate/); assert.doesNotMatch(sync, /events\//); assert.doesNotMatch(sync, /indexedDB\.open/); assert.doesNotMatch(sync, /context.*activity/i);
});
test('service worker precaches every local module and shared v2 without touching shared v1', () => {
  const serviceWorker = read('sw.js'); for (const module of ['sources.js', 'merge.js', 'day-model.js', 'markdown.js', 'store.js', 'sync.js']) assert.match(serviceWorker, new RegExp(module.replace('.', '\\.')));
  assert.match(serviceWorker, /shared\/v2\/journal\.js/); assert.match(serviceWorker, /shared\/v1\/sync\.js/);
});
test('token is not included in Markdown, backup, or note envelope', () => {
  const markdown = read('src/markdown.js'); const store = read('src/store.js'); const sync = read('src/sync.js'); assert.doesNotMatch(markdown, /token/); assert.doesNotMatch(store, /sync\.token/); assert.match(sync, /JSON\.stringify\(\{ v: 1, context, date, updatedAt: pending\.updatedAt, markdown: pending\.markdown \}/); assert.doesNotMatch(sync, /JSON\.stringify\(\{[^}]*token/);
});
