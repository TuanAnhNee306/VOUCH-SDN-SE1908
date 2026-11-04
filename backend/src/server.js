const { connectDb, disconnectDb } = require('./config/db');
const { int, bool } = require('./config/env');
const { createApp } = require('./app');
const { startJobs } = require('./jobs');
const { seedIfEmpty } = require('./seed');
const { verifyMail } = require('./services/mail');

async function main() {
  await connectDb();
  if (bool('AUTO_SEED', true)) await seedIfEmpty();
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
