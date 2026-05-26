#!/usr/bin/env node
/**
 * V4 Endpoint Smoke Test
 * Verifica todos os endpoints GET do frontend V4 contra o backend.
 *
 * Uso:
 *   node scripts/check-v4-endpoints.js --url http://localhost:4000 --token <jwt>
 *
 * Flags:
 *   --url    Base URL do servidor (default: http://localhost:4000)
 *   --token  JWT Bearer token (obrigatório)
 *   --bail   Para na primeira falha
 *   --json   Saída em JSON puro
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

// ─── CLI ARGS ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
}
function hasFlag(name) {
  return args.includes(name);
}

const BASE_URL = flag('--url') ?? 'http://localhost:4000';
const TOKEN = flag('--token');
const BAIL = hasFlag('--bail');
const JSON_MODE = hasFlag('--json');

if (!TOKEN) {
  console.error('Erro: --token é obrigatório.');
  console.error('Uso: node scripts/check-v4-endpoints.js --url http://localhost:4000 --token <jwt>');
  process.exit(1);
}

// ─── ENDPOINTS VERIFICADOS ────────────────────────────────────────────────────

const ENDPOINTS = [
  // Bootstrap
  { label: 'Auth session',          path: '/api/v4/auth/session' },
  { label: 'Features flags',        path: '/api/v4/features' },
  { label: 'System readiness',      path: '/api/v4/system/readiness' },

  // Dashboard
  { label: 'Dashboard KPIs',        path: '/api/v4/dashboard/kpis' },
  { label: 'Dashboard overview',    path: '/api/v4/dashboard/overview' },
  { label: 'Dashboard activity',    path: '/api/v4/dashboard/activity' },
  { label: 'Dashboard performance', path: '/api/v4/dashboard/performance' },
  { label: 'Dashboard alerts-summary', path: '/api/v4/dashboard/alerts-summary' },

  // Inventory
  { label: 'Inventory summary',     path: '/api/v4/inventory/summary' },
  { label: 'Inventory boards',      path: '/api/v4/inventory/boards' },
  { label: 'Inventory regions',     path: '/api/v4/inventory/regions' },

  // Contracts
  { label: 'Contracts summary',     path: '/api/v4/contracts/summary' },
  { label: 'Contracts list',        path: '/api/v4/contracts' },
  { label: 'Contracts /list alias', path: '/api/v4/contracts/list' },
  { label: 'Contracts active',      path: '/api/v4/contracts/active' },
  { label: 'Contracts expiring',    path: '/api/v4/contracts/expiring' },
  { label: 'Contracts timeline',    path: '/api/v4/contracts/timeline' },

  // Commercial
  { label: 'Commercial pipeline',      path: '/api/v4/commercial/pipeline' },
  { label: 'Commercial opportunities', path: '/api/v4/commercial/opportunities' },
  { label: 'Commercial proposals',     path: '/api/v4/commercial/proposals' },
  { label: 'Commercial conversions',   path: '/api/v4/commercial/conversions' },
  { label: 'Commercial activities',    path: '/api/v4/commercial/activities' },

  // Alerts
  { label: 'Alerts list',      path: '/api/v4/alerts' },
  { label: 'Alerts summary',   path: '/api/v4/alerts/summary' },
  { label: 'Alerts critical',  path: '/api/v4/alerts/critical' },
  { label: 'Alerts unread',    path: '/api/v4/alerts/unread' },
  { label: 'Alerts by-domain', path: '/api/v4/alerts/by-domain' },

  // Operations
  { label: 'Operations timeline',       path: '/api/v4/operations/timeline' },
  { label: 'Operations summary',        path: '/api/v4/operations/summary' },
  { label: 'Operations tasks',          path: '/api/v4/operations/tasks' },
  { label: 'Operations tasks/pending',  path: '/api/v4/operations/tasks/pending' },
  { label: 'Operations by-domain',      path: '/api/v4/operations/by-domain' },

  // Reports
  { label: 'Reports summary',   path: '/api/v4/reports/summary' },
  { label: 'Reports analytics', path: '/api/v4/reports/analytics' },
  { label: 'Reports exports',   path: '/api/v4/reports/exports' },
  { label: 'Reports by-period', path: '/api/v4/reports/by-period' },
  { label: 'Reports by-domain', path: '/api/v4/reports/by-domain' },

  // Activity
  { label: 'Activity timeline',  path: '/api/v4/activity/timeline' },
  { label: 'Activity feed',      path: '/api/v4/activity/feed' },
  { label: 'Activity audit',     path: '/api/v4/activity/audit' },
  { label: 'Activity by-domain', path: '/api/v4/activity/by-domain' },

  // Campaigns
  { label: 'Campaigns summary',     path: '/api/v4/campaigns/summary' },
  { label: 'Campaigns list',        path: '/api/v4/campaigns' },
  { label: 'Campaigns active',      path: '/api/v4/campaigns/active' },
  { label: 'Campaigns scheduled',   path: '/api/v4/campaigns/scheduled' },
  { label: 'Campaigns performance', path: '/api/v4/campaigns/performance' },

  // Realtime health
  { label: 'Realtime health',   path: '/api/v4/realtime/health' },
];

// ─── HTTP HELPER ──────────────────────────────────────────────────────────────

function request(path) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const lib = url.protocol === 'https:' ? https : http;

    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      rejectUnauthorized: false,
    };

    const req = lib.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, body: parsed, raw: body });
      });
    });

    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    req.end();
  });
}

// ─── RUNNER ───────────────────────────────────────────────────────────────────

const PASS = '\x1b[32m✅\x1b[0m';
const FAIL = '\x1b[31m❌\x1b[0m';
const WARN = '\x1b[33m⚠️ \x1b[0m';

function statusIcon(status, body) {
  if (status === 0) return FAIL;
  if (status === 401 || status === 403) return WARN;
  if (status === 404) return FAIL;
  if (status >= 500) return FAIL;
  if (status >= 200 && status < 300) {
    if (body && body.success === false) return WARN;
    return PASS;
  }
  return WARN;
}

function classify(status, body) {
  if (status === 0) return 'FAIL';
  if (status === 404) return 'FAIL';
  if (status >= 500) return 'FAIL';
  if (status === 401 || status === 403) return 'AUTH';
  if (status >= 200 && status < 300) {
    if (body && body.success === false) return 'WARN';
    return 'OK';
  }
  return 'WARN';
}

async function run() {
  const results = [];
  let passed = 0;
  let failed = 0;
  let warned = 0;

  if (!JSON_MODE) {
    console.log(`\n🔍 V4 Endpoint Smoke Test`);
    console.log(`   URL:   ${BASE_URL}`);
    console.log(`   Rotas: ${ENDPOINTS.length}\n`);
  }

  for (const ep of ENDPOINTS) {
    const start = Date.now();
    const res = await request(ep.path);
    const ms = Date.now() - start;
    const cls = classify(res.status, res.body);
    const icon = statusIcon(res.status, res.body);
    const detail = res.error ?? `HTTP ${res.status}`;

    results.push({ label: ep.label, path: ep.path, status: res.status, class: cls, ms, error: res.error ?? null });

    if (!JSON_MODE) {
      const msStr = `${ms}ms`.padStart(6);
      const pathStr = ep.path.padEnd(52);
      console.log(`  ${icon} ${pathStr} ${detail.padEnd(8)} ${msStr}  ${ep.label}`);
    }

    if (cls === 'OK') passed++;
    else if (cls === 'FAIL') {
      failed++;
      if (BAIL) {
        console.error(`\n💥 --bail: parando na primeira falha (${ep.path})`);
        break;
      }
    } else {
      warned++;
    }
  }

  if (JSON_MODE) {
    console.log(JSON.stringify({ passed, failed, warned, results }, null, 2));
  } else {
    console.log(`\n${'─'.repeat(72)}`);
    console.log(`  ${PASS} OK: ${passed}   ${FAIL} FAIL: ${failed}   ${WARN} WARN/AUTH: ${warned}`);
    console.log(`  Total: ${ENDPOINTS.length} endpoints verificados\n`);

    if (failed > 0) {
      console.log('  Falhas:');
      results.filter((r) => r.class === 'FAIL').forEach((r) => {
        console.log(`    ❌ ${r.path} — HTTP ${r.status}${r.error ? ` (${r.error})` : ''}`);
      });
      console.log();
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
