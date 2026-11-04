import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAllCampaigns, loadCatalogPage } from '../src/utils/catalog.js';

test('type filtering includes matches beyond the first server page, with correct total and pagination', async () => {
  const data = Array.from({ length: 225 }, (_, id) => ({ id, voucherType: id < 100 ? 'STORED_VALUE' : 'CASHBACK' }));
  const calls = [];
  const client = { get: async path => {
    const q = new URL(path, 'https://example.test').searchParams;
    assert.equal(q.get('keyword'), 'cà phê');
    assert.equal(q.get('brandId'), 'brand-1');
    assert.equal(q.has('voucherType'), false);
    const page = Number(q.get('page')); const size = Number(q.get('pageSize'));
    calls.push(page);
    return { items: data.slice((page - 1) * size, page * size), total: data.length };
  } };
  const result = await loadCatalogPage(client, new URLSearchParams({keyword: 'cà phê', brandId: 'brand-1'}).toString(), { type: 'CASHBACK', page: 2 });
  assert.equal(result.total, 125);
  assert.deepEqual(result.items.map(x => x.id), Array.from({length: 12}, (_, i) => 112 + i));
  assert.deepEqual(calls, [1, 2, 3]);
});

test('unfiltered results retain server pagination and do not request the whole catalog', async () => {
  const calls = [];
  const response = { items: [{id: 'final'}], total: 37, page: 4, pageSize: 12 };
  const result = await loadCatalogPage({ get: async path => { calls.push(path); return response; } }, 'sort=price_asc', { page: 4 });
  assert.equal(result, response);
  assert.deepEqual(calls, ['/campaigns?sort=price_asc&page=4&pageSize=12']);
});

test('failed subsequent pages surface an error instead of presenting partial results as complete', async () => {
  const client = { get: async path => {
    if (path.includes('page=2&')) throw new Error('Page unavailable');
    return { items: [], total: 101 };
  } };
  await assert.rejects(loadAllCampaigns(client), /Page unavailable/);
});
