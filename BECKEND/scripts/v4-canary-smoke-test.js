#!/usr/bin/env node
/**
 * InMidia V4 — Canary Smoke Test
 *
 * Valida todos os endpoints V4 críticos para um tenant piloto.
 *
 * Uso:
 *   node scripts/v4-canary-smoke-test.js \
 *     --url https://api.inmidia.com \
 *     --email admin@empresa.com \
 *     --password SuaSenha
 *
 * Ou com token direto:
 *   V4_SMOKE_TOKEN=<jwt> node scripts/v4-canary-smoke-test.js \
 *     --url https://api.inmidia.com
 */

const https = require('https');
const http  = require('http');
const url   = require('url');

// ── Config ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2).reduce((acc, arg, i, arr) => {
  if (arg.startsWith('--')) acc[arg.slice(2)] = arr[i + 1] ?? true;
  return acc;
}, {});

const BASE_URL  = (args.url || process.env.V4_SMOKE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL     = args.email    || process.env.V4_SMOKE_EMAIL    || '';
const PASSWORD  = args.password || process.env.V4_SMOKE_PASSWORD || '';
const TOKEN_ENV = process.env.V4_SMOKE_TOKEN || '';

// Cores ANSI
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function req(method, path, { body, token, timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(`${BASE_URL}${path}`);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const data   = body ? JSON.stringify(body) : null;

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data  ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const request = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(timeout, () => {
      request.destroy();
      reject(new Error(`Timeout após ${timeout}ms em ${path}`));
    });

    if (data) request.write(data);
    request.end();
  });
}

let passed = 0;
let failed = 0;
const failures = [];

function ok(label) {
  passed++;
  console.log(`  ${C.green}✓${C.reset} ${label}`);
}

function fail(label, detail) {
  failed++;
  failures.push({ label, detail });
  console.log(`  ${C.red}✗${C.reset} ${label}`);
  if (detail) console.log(`    ${C.gray}→ ${detail}${C.reset}`);
}

function section(title) {
  console.log(`\n${C.bold}${C.cyan}▸ ${title}${C.reset}`);
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function getToken() {
  if (TOKEN_ENV) return TOKEN_ENV;
  if (!EMAIL || !PASSWORD) {
    console.error(`${C.red}Erro: forneça --email e --password, ou defina V4_SMOKE_TOKEN${C.reset}`);
    process.exit(1);
  }
  const res = await req('POST', '/api/v1/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  if (res.status !== 200 || !res.body?.data?.token) {
    console.error(`${C.red}Login falhou (${res.status}): ${JSON.stringify(res.body)}${C.reset}`);
    process.exit(1);
  }
  return res.body.data.token;
}

// ── Testes ────────────────────────────────────────────────────────────────────

async function testAuth(token) {
  section('AUTH — session V4');

  const res = await req('GET', '/api/v4/auth/session', { token });
  if (res.status === 200 && res.body?.success) {
    ok('GET /api/v4/auth/session → 200');
    const perms = res.body.data?.permissions ?? [];
    if (perms.includes('auth.session.read')) ok('auth.session.read presente');
    else fail('auth.session.read ausente', JSON.stringify(perms.slice(0, 5)));

    const legacy = perms.filter((p) => /^(placas|contratos|propostas|relatorios)\.|^audit\./.test(p));
    if (legacy.length === 0) ok('Nenhuma permissão legada na sessão V4');
    else fail('Permissões legadas encontradas na sessão V4', legacy.join(', '));

    const role = res.body.data?.role;
    if (role) ok(`Role: ${role}`);
    else fail('Role ausente na sessão');

    return { perms, role, tenantId: res.body.data?.tenantId };
  } else {
    fail(`GET /api/v4/auth/session → ${res.status}`, JSON.stringify(res.body));
    return null;
  }
}

async function testFeatureFlags(token) {
  section('FEATURE FLAGS');

  const res = await req('GET', '/api/v4/features', { token });
  if (res.status !== 200 || !res.body?.success) {
    fail(`GET /api/v4/features → ${res.status}`, JSON.stringify(res.body));
    return null;
  }
  ok('GET /api/v4/features → 200');

  const flags = res.body.data ?? {};
  const v4Painel = flags.v4Painel === true;
  if (v4Painel) ok('v4Painel: true — tenant habilitado ✓');
  else fail('v4Painel: false — tenant não habilitado (adicionar a V4_ENABLED_TENANTS)');

  if (flags.syncDevtools === false) ok('syncDevtools: false — seguro para produção');
  else fail('syncDevtools: true — risco em produção', 'definir V4_DEVTOOLS_ALL=false');

  return flags;
}

async function testReadiness(token) {
  section('READINESS');

  const res = await req('GET', '/api/v4/system/readiness', { token });
  if (res.status !== 200 || !res.body?.success) {
    fail(`GET /api/v4/system/readiness → ${res.status}`, JSON.stringify(res.body));
    return;
  }
  ok('GET /api/v4/system/readiness → 200');

  const data = res.body.data ?? {};
  for (const [key, val] of Object.entries(data)) {
    if (key === 'checkedAt') continue;
    if (val === 'ok') ok(`  ${key}: ok`);
    else fail(`  ${key}: ${val}`);
  }
}

async function testDomains(token) {
  section('DOMÍNIOS V4 — endpoints de leitura');

  const endpoints = [
    ['GET', '/api/v4/inventory/summary',   'inventory.summary'],
    ['GET', '/api/v4/inventory/boards',    'inventory.boards'],
    ['GET', '/api/v4/dashboard/kpis',      'dashboard.kpis'],
    ['GET', '/api/v4/dashboard/overview',  'dashboard.overview'],
    ['GET', '/api/v4/contracts/summary',   'contracts.summary'],
    ['GET', '/api/v4/contracts/list',      'contracts.list'],
    ['GET', '/api/v4/commercial/pipeline', 'commercial.pipeline'],
    ['GET', '/api/v4/alerts',              'alerts.list'],
    ['GET', '/api/v4/alerts/summary',      'alerts.summary'],
    ['GET', '/api/v4/operations/summary',  'operations.summary'],
    ['GET', '/api/v4/reports/summary',     'reports.summary'],
  ];

  for (const [method, path, label] of endpoints) {
    try {
      const res = await req(method, path, { token });
      if (res.status === 200 && res.body?.success) {
        ok(`${method} ${path}`);
      } else if (res.status === 403) {
        fail(`${label} → 403 (permissão insuficiente)`, path);
      } else {
        fail(`${label} → ${res.status}`, JSON.stringify(res.body).slice(0, 120));
      }
    } catch (err) {
      fail(`${label} → erro de rede`, err.message);
    }
  }
}

async function testAnonymous() {
  section('SEGURANÇA — sem token');

  const paths = ['/api/v4/auth/session', '/api/v4/features', '/api/v4/inventory/summary'];
  for (const path of paths) {
    const res = await req('GET', path);
    if (res.status === 401) ok(`${path} → 401 (correto)`);
    else fail(`${path} deveria retornar 401, recebeu ${res.status}`);
  }
}

async function testRealtime(token) {
  section('REALTIME — stream token');

  try {
    const health = await req('GET', '/api/v4/realtime/health', { token, timeout: 5000 });
    if (health.status === 200 && health.body?.success) {
      ok('GET /api/v4/realtime/health -> 200');
    } else {
      fail(`realtime health V4 -> ${health.status}`, JSON.stringify(health.body).slice(0, 120));
    }
  } catch (err) {
    fail('realtime health V4 -> erro de rede', err.message);
  }

  try {
    const res = await req('POST', '/api/v4/realtime/stream-token', { token, timeout: 5000 });
    if (res.status === 200 && res.body?.success) {
      ok('POST /api/v4/realtime/stream-token -> 200');
      if (res.body.data?.token) ok('stream-token gerado');
      else fail('stream-token ausente na resposta');
    } else {
      fail(`stream-token → ${res.status}`, JSON.stringify(res.body).slice(0, 120));
    }
  } catch (err) {
    fail('stream-token → erro de rede', err.message);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}═══════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  InMidia V4 — Canary Smoke Test${C.reset}`);
  console.log(`${C.bold}  URL: ${BASE_URL}${C.reset}`);
  console.log(`${C.bold}═══════════════════════════════════════════════${C.reset}`);

  let token;
  try {
    token = await getToken();
    console.log(`\n${C.green}✓ Login OK${C.reset}`);
  } catch (err) {
    console.error(`\n${C.red}✗ Login falhou: ${err.message}${C.reset}`);
    process.exit(1);
  }

  const session = await testAuth(token);
  const flags   = await testFeatureFlags(token);
  await testReadiness(token);
  await testDomains(token);
  await testAnonymous();
  await testRealtime(token);

  // ── Resumo ──────────────────────────────────────────────────────────────────
  const total  = passed + failed;
  const pct    = total > 0 ? Math.round((passed / total) * 100) : 0;
  const symbol = failed === 0 ? C.green : C.red;

  console.log(`\n${C.bold}═══════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  Resultado: ${symbol}${passed}/${total} (${pct}%)${C.reset}`);
  if (flags?.v4Painel !== true) {
    console.log(`\n${C.yellow}⚠  v4Painel=false — adicionar tenantId a V4_ENABLED_TENANTS${C.reset}`);
  }
  if (failed > 0) {
    console.log(`\n${C.red}${C.bold}Falhas (${failed}):${C.reset}`);
    failures.forEach(({ label, detail }) => {
      console.log(`  ${C.red}✗${C.reset} ${label}`);
      if (detail) console.log(`    ${C.gray}${detail}${C.reset}`);
    });
    console.log(`\n${C.yellow}→ Verificar runbook: BECKEND/docs/V4_CANARY_RUNBOOK.md${C.reset}`);
  } else {
    console.log(`\n${C.green}${C.bold}✓ Todos os checks passaram — canário aprovado${C.reset}`);
  }
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${C.red}Erro fatal: ${err.message}${C.reset}`);
  process.exit(1);
});
