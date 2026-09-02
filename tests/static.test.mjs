import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
test('PWA contains the production shell and approved icon assets', () => {
  for (const file of ['index.html', 'assets/app.css', 'src/app.js', 'src/store.js', 'src/deployment.js', 'src/sync.js', 'src/markdown.js', 'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']) assert.ok(existsSync(join(root, file)), file);
  assert.match(read('index.html'), /By app/); assert.match(read('index.html'), /Timeline/); assert.match(read('index.html'), /Markdown/); assert.match(read('index.html'), /Daily note/);
});
test('only the ten approved sources are registered', async () => {
  const { SOURCE_APPS } = await import('../src/sources.js'); assert.deepEqual(SOURCE_APPS.map(({ id }) => id), ['tide', 'focus', 'loom', 'petal', 'folio', 'quill', 'slate', 'grove', 'today', 'cove']);
  for (const excluded of ['vault', 'trace', 'atlas', 'shared']) assert.ok(!SOURCE_APPS.some(({ id }) => id === excluded));
});
test('the source summary is derived from the registered source list', () => {
  assert.match(read('src/app.js'), /`\$\{SOURCE_APPS\.length\} sources/);
  assert.doesNotMatch(read('src/app.js'), /`8 sources/);
  assert.match(read('index.html'), />10 sources · not refreshed</);
});
test('central reader uses journal projections and no foreign app storage', () => {
  const sync = read('src/sync.js'); assert.match(sync, /journal\.readDate/); assert.doesNotMatch(sync, /events\//); assert.doesNotMatch(sync, /indexedDB\.open/); assert.doesNotMatch(sync, /context.*activity/i);
});
test('service worker precaches every local module and shared v2 without touching shared v1', () => {
  const serviceWorker = read('sw.js'); for (const module of ['sources.js', 'merge.js', 'day-model.js', 'markdown.js', 'store.js', 'deployment.js', 'sync.js']) assert.match(serviceWorker, new RegExp(module.replace('.', '\\.')));
  assert.match(serviceWorker, /shared\/v2\/journal\.js/); assert.match(serviceWorker, /shared\/v1\/sync\.js/);
});
test('token is not included in Markdown, backup, or note envelope', () => {
  const markdown = read('src/markdown.js'); const store = read('src/store.js'); const sync = read('src/sync.js'); assert.doesNotMatch(markdown, /token/); assert.doesNotMatch(store, /sync\.token/); assert.match(sync, /JSON\.stringify\(\{ v: 1, context, date, updatedAt: pending\.updatedAt, markdown: pending\.markdown \}/); assert.doesNotMatch(sync, /JSON\.stringify\(\{[^}]*token/);
});
test('settings can be opened on a phone, where the tool rail is hidden', () => {
  // The rail is display:none under 800px and #open-settings lived only inside
  // it, so on an iPhone there was no way to reach Settings at all — and no way
  // to enter the token, which is the only thing that makes the app load data.
  const html = read('index.html');
  const css = read('assets/app.css');
  const rail = html.slice(html.indexOf('<aside class="tool-rail"'), html.indexOf('</aside>'));
  const outsideRail = html.replace(rail, '');
  assert.match(outsideRail, /id="open-settings-compact"/, 'a Settings control must exist outside the tool rail');
  assert.match(read('src/app.js'), /open-settings-compact'\)\.onclick = openSettings/, 'and it must be wired up');
  assert.match(css, /\.settings-button\{display:none\}/);
  assert.equal((css.match(/\.settings-button\{display:inline-flex\}/g) || []).length, 2,
    'it must be revealed in BOTH media queries that hide the rail (narrow and short)');
});
test('nothing focusable is under 16px, or iOS zooms the whole page', () => {
  const css = read('assets/app.css');
  assert.doesNotMatch(css, /\.field select\{font-size:12px\}/, 'a <select> under 16px makes iOS zoom on focus');
  assert.match(css, /\.field input,\.field select\{[^}]*font-size:16px/);
  assert.match(css, /\.file-button input\{[^}]*font-size:16px\}/);
});
test('touch targets meet the 44px rule', () => {
  const css = read('assets/app.css');
  assert.match(css, /\.text-button\{[^}]*min-width:44px;min-height:44px/);
  assert.match(css, /\.icon-button\{[^}]*height:44px/);
  assert.match(css, /\.icon-button\.small\{width:44px/);
  assert.match(css, /\.rail-tabs button\{[^}]*min-height:44px/);
  assert.match(css, /\.source-status\{[^}]*min-height:44px/);
  assert.match(css, /\.segmented button\{[^}]*min-height:44px/);
  assert.match(css, /\.markdown-actions button,[^}]*min-height:44px/);
  for (const block of css.match(/\.bottom-nav button\{[^}]*\}/g) || []) assert.match(block, /min-height:4[4-9]px|min-height:[5-9]\dpx/, block);
});
test('every queued note is flushed, not only the day on screen', () => {
  // flushNote() only ever ran for state.date and nothing else drained the
  // outbox, so a note typed and then navigated away from stayed on the device
  // for ever while the status line still read "waiting to sync".
  const app = read('src/app.js');
  assert.match(app, /async function flushOutbox\(\)/);
  assert.match(app, /for \(const item of await listItems\('outbox'\)\)/);
  assert.match(app, /loadDay\(\)\.then\(flushOutbox\)/, 'queued notes must also be flushed at startup');
  assert.match(app, /addEventListener\('online'[\s\S]{0,120}flushOutbox\(\)/);
});
test('the database connection is reused instead of reopened per write', () => {
  // Every keystroke in the Daily note writes both the note and its outbox
  // entry, so open/close per operation cost two full open() round trips per
  // character on the device with the least to spare.
  const store = read('src/store.js');
  assert.match(store, /let dbPromise = null;/);
  assert.match(store, /dbPromise \|\|= openDb\(\)/);
  assert.doesNotMatch(store, /finally \{ db\.close\(\); \}/);
  assert.match(store, /onversionchange/, 'a long-lived connection must yield to an upgrade');
});
test('a remembered date is validated before it is trusted', () => {
  assert.match(read('src/app.js'), /const rememberedDate = \(\)/);
});
test('the bundled font ships its licence', () => {
  // WebApp_House_Style.md 3: bundle Lexend for offline use, licence file included.
  assert.ok(existsSync(join(root, 'licenses/Lexend-OFL.txt')));
  assert.ok(existsSync(join(root, 'THIRD_PARTY_NOTICES.md')));
});
test('the cache version moved with the shipped files', () => {
  // cache-first: leaving the version alone leaves installed devices on the old
  // files for ever.
  assert.match(read('sw.js'), /const VERSION = '2026\.09\.02-covenotes1';/);
});

test('account-portable settings report custom-domain sync configuration failures', () => {
  const html = read('index.html');
  const sync = read('src/sync.js');
  const app = read('src/app.js');
  assert.doesNotMatch(html, /jennie-verse/);
  assert.match(html, /owned by the GitHub Pages account/);
  assert.match(sync, /configurationError: error\.message/);
  assert.match(app, /state\.day\?\.configurationError/);
  assert.match(app, /sync unavailable on this domain/);
});
