import test from 'node:test';
import assert from 'node:assert/strict';
import { pagesOwner, webappDataConfig } from '../src/deployment.js';

test('Pages owner follows the deployment hostname after an account transfer', () => {
  assert.equal(pagesOwner({ hostname: 'New-Owner.github.io' }), 'new-owner');
  assert.deepEqual(webappDataConfig('secret', { hostname: 'new-owner.github.io' }), {
    owner: 'new-owner', repo: 'webapp-data', branch: 'main', token: 'secret',
  });
});

test('custom domains fail explicitly instead of writing to a stale repository', () => {
  assert.throws(() => pagesOwner({ hostname: 'journal.example.com' }), error =>
    error.code === 'PAGES_OWNER_UNRESOLVED' && error.type === 'configuration');
});
