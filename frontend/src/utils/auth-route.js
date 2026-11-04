export function authDestination(role, next = '/') {
  const home = { ADMIN: '/web/admin/dashboard', BRAND_OWNER: '/web/brand/overview', STORE_STAFF: '/web/store/overview' };
  if (home[role]) return home[role];
  if (role !== 'CUSTOMER') return '/';
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') && !/^\/web(?:[/?#]|$)/.test(next) && !/^\/login(?:[/?#]|$)/.test(next) ? next : '/';
}
