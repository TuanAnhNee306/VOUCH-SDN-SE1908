const { connectDb, disconnectDb } = require('./config/db');
const { int, bool } = require('./config/env');
const { createApp } = require('./app');
const { startJobs } = require('./jobs');
const { seedIfEmpty } = require('./seed');
const { verifyMail } = require('./services/mail');

async function main() {
  require('./config/production').validateProduction();
  await connectDb();
  if (process.env.NODE_ENV !== 'production' && bool('AUTO_SEED', true)) await seedIfEmpty();
  // Idempotent demo catalog: useful on free hosting where one-off jobs are unavailable.
  if (process.env.NODE_ENV !== 'production' && bool('SEED_CATALOG_ON_START', false)) {
    const { seedCatalog } = require('./seed-catalog');
    await seedCatalog();
  }
  await verifyMail();
  const port = int('PORT', 3000);
  const server = createApp().listen(port, () => console.log(`[api] Voucher Platform API chay tai http://localhost:${port}/api`));
  startJobs();

  const shutdown = async () => {
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('Khong khoi dong duoc may chu:', e);
  process.exit(1);
});
