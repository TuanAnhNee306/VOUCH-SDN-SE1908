const { SystemConfig } = require('../models');
const { str } = require('../config/env');

const COMMISSION_RATE_KEY = 'commission_rate';
const REFUND_SANDBOX_KEY = 'refund_sandbox_result';

const validRate = (v) => {
  const r = Number(v);
  return Number.isFinite(r) && r > 0 && r < 1 ? r : null;
};

async function getCommissionRate() {
  const c = await SystemConfig.findOne({ key: COMMISSION_RATE_KEY });
  return validRate(c?.value) ?? validRate(process.env.DEFAULT_COMMISSION_RATE) ?? 0.1;
}

// Che do cong hoan gia lap: quan tri vien doi tren web, mac dinh REFUND_SANDBOX_RESULT
async function getRefundSandboxMode() {
  const c = await SystemConfig.findOne({ key: REFUND_SANDBOX_KEY });
  return c?.value || str('REFUND_SANDBOX_RESULT', 'success');
}

module.exports = { COMMISSION_RATE_KEY, REFUND_SANDBOX_KEY, validRate, getCommissionRate, getRefundSandboxMode };
