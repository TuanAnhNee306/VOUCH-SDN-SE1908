import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authDestination } from '../src/utils/auth-route.js';
test('Authenticated roles route to their portal and Customer retains checkout context', () => {
  assert.equal(authDestination('ADMIN'), '/web/admin/dashboard');
  assert.equal(authDestination('BRAND_OWNER'), '/web/brand/overview');
  assert.equal(authDestination('STORE_STAFF'), '/web/store/overview');
  assert.equal(authDestination('CUSTOMER', '/checkout?cart=1'), '/checkout?cart=1');
  for (const next of ['//evil.test', '/\\evil.test', '/web?x=1', '/web/admin', '/login?next=x', 'https://evil.test']) assert.equal(authDestination('CUSTOMER', next), '/');
});
