// Fetch every matching API page before applying a filter unsupported by the API.
export async function loadAllCampaigns(client, query = '') {
  const first = await client.get(`/campaigns?${query}&page=1&pageSize=100`);
  const requests = [];
  for (let page = 2; page <= Math.ceil(first.total / 100); page++) {
    requests.push(client.get(`/campaigns?${query}&page=${page}&pageSize=100`));
  }
  const rest = await Promise.all(requests);
  return [...first.items, ...rest.flatMap(result => result.items)];
}

export async function loadCatalogPage(client, query, { type = '', page = 1, pageSize = 12 } = {}) {
  if (!type) return client.get(`/campaigns?${query}&page=${page}&pageSize=${pageSize}`);
  const matching = (await loadAllCampaigns(client, query)).filter(campaign => campaign.voucherType === type);
  return { items: matching.slice((page - 1) * pageSize, page * pageSize), total: matching.length, page, pageSize };
}
