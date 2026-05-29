#!/usr/bin/env ts-node
/**
 * Staging Seed — Multi-Tenant Isolation Validation
 *
 * Provision two fully isolated tenants with all entity types and print
 * a 36-scenario checklist to validate cross-tenant isolation in staging.
 *
 * Usage:
 *   MONGODB_URI=mongodb://localhost:27017/inmidia_staging ts-node scripts/staging-seed-multitenant.ts
 *   MONGODB_URI=... ts-node scripts/staging-seed-multitenant.ts --cleanup
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// ── Config ────────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI env var is required');
  process.exit(1);
}

const CLEANUP = process.argv.includes('--cleanup');

// ── Helpers ───────────────────────────────────────────────────────────────────

function oid() {
  return new mongoose.Types.ObjectId();
}

function apiKey(prefix: string) {
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

async function apiKeyFields(rawKey: string) {
  const separator = rawKey.lastIndexOf('_');
  const prefix = rawKey.slice(0, separator);
  const secret = rawKey.slice(separator + 1);
  return {
    api_key_prefix: prefix,
    api_key_hash: await bcrypt.hash(secret, 10),
    apiKey: undefined,
  };
}

// ── Schema stubs (lean — just enough to seed) ────────────────────────────────

const empresaSchema = new mongoose.Schema({ nome: String, slug: String }, { strict: false });
const placaSchema   = new mongoose.Schema({ empresaId: mongoose.Schema.Types.ObjectId, numero_placa: String }, { strict: false });
const regiaoSchema  = new mongoose.Schema({ empresaId: mongoose.Schema.Types.ObjectId, nome: String }, { strict: false });
const clienteSchema = new mongoose.Schema({ empresaId: mongoose.Schema.Types.ObjectId, nome: String }, { strict: false });
const aluguelSchema = new mongoose.Schema({ empresaId: mongoose.Schema.Types.ObjectId }, { strict: false });
const piSchema      = new mongoose.Schema({ empresaId: mongoose.Schema.Types.ObjectId }, { strict: false });
const contratoSchema= new mongoose.Schema({ empresaId: mongoose.Schema.Types.ObjectId }, { strict: false });
const temporalSchema= new mongoose.Schema({ empresaId: mongoose.Schema.Types.ObjectId }, { strict: false });
const apiKeySchema  = new mongoose.Schema({ empresaId: mongoose.Schema.Types.ObjectId, key: String, active: Boolean }, { strict: false });

const Empresa   = mongoose.models['SeedEmpresa']   || mongoose.model('SeedEmpresa',   empresaSchema, 'empresas');
const Placa     = mongoose.models['SeedPlaca']     || mongoose.model('SeedPlaca',     placaSchema,   'placas');
const Regiao    = mongoose.models['SeedRegiao']    || mongoose.model('SeedRegiao',     regiaoSchema,  'regiaos');
const Cliente   = mongoose.models['SeedCliente']   || mongoose.model('SeedCliente',   clienteSchema, 'clientes');
const Aluguel   = mongoose.models['SeedAluguel']   || mongoose.model('SeedAluguel',   aluguelSchema, 'alugueis');
const PIModel   = mongoose.models['SeedPI']        || mongoose.model('SeedPI',        piSchema,      'propostainternas');
const Contrato  = mongoose.models['SeedContrato']  || mongoose.model('SeedContrato',  contratoSchema,'contratos');
const Temporal  = mongoose.models['SeedTemporal']  || mongoose.model('SeedTemporal',  temporalSchema,'temporalreservations');
const ApiKey    = mongoose.models['SeedApiKey']    || mongoose.model('SeedApiKey',    apiKeySchema,  'publicapikeys');

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGODB_URI!);
  console.log('✅  Connected to MongoDB\n');

  if (CLEANUP) {
    await cleanup();
    process.exit(0);
  }

  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

  // ── Tenant A ──────────────────────────────────────────────────────────────
  const keyA = apiKey('alpha');
  const empA = await Empresa.create({ _id: oid(), nome: 'Empresa Alpha (Staging)', slug: 'alpha-staging', ativo: true, ...(await apiKeyFields(keyA)) });
  const regiaoA = await Regiao.create({ _id: oid(), empresaId: empA._id, nome: 'Região Sul Alpha', ativo: true });
  const placaA1 = await Placa.create({ _id: oid(), empresaId: empA._id, numero_placa: 'ALPHA-001', regiaoId: regiaoA._id, disponivel: true });
  const placaA2 = await Placa.create({ _id: oid(), empresaId: empA._id, numero_placa: 'ALPHA-002', regiaoId: regiaoA._id, disponivel: false });
  const clienteA = await Cliente.create({ _id: oid(), empresaId: empA._id, nome: 'Cliente Alpha' });
  const piA = await PIModel.create({ _id: oid(), empresaId: empA._id, status: 'APPROVED', clienteId: clienteA._id, placas: [placaA1._id], startDate: now, endDate: future, valorTotal: 1500 });
  const contratoA = await Contrato.create({ _id: oid(), empresaId: empA._id, status: 'ativo', piId: piA._id, clienteId: clienteA._id });
  const aluguelA = await Aluguel.create({ _id: oid(), empresaId: empA._id, placaId: placaA1._id, clienteId: clienteA._id, startDate: now, endDate: future, valor_mensal: 1500 });
  const temporalA = await Temporal.create({ _id: oid(), empresaId: empA._id, plateId: String(placaA1._id), sourceType: 'CONTRACT', sourceId: String(contratoA._id), status: 'ACTIVE', startDate: now, endDate: future });
  await ApiKey.create({ _id: oid(), empresaId: empA._id, key: keyA, active: true, scopes: ['catalog:read', 'inventory:read', 'inventory:availability', 'geo:read'] });

  // ── Tenant B ──────────────────────────────────────────────────────────────
  const keyB = apiKey('beta');
  const empB = await Empresa.create({ _id: oid(), nome: 'Empresa Beta (Staging)', slug: 'beta-staging', ativo: true, ...(await apiKeyFields(keyB)) });
  const regiaoB = await Regiao.create({ _id: oid(), empresaId: empB._id, nome: 'Região Norte Beta', ativo: true });
  const placaB1 = await Placa.create({ _id: oid(), empresaId: empB._id, numero_placa: 'BETA-001', regiaoId: regiaoB._id, disponivel: true });
  const placaB2 = await Placa.create({ _id: oid(), empresaId: empB._id, numero_placa: 'BETA-002', regiaoId: regiaoB._id, disponivel: false });
  const clienteB = await Cliente.create({ _id: oid(), empresaId: empB._id, nome: 'Cliente Beta' });
  const piB = await PIModel.create({ _id: oid(), empresaId: empB._id, status: 'APPROVED', clienteId: clienteB._id, placas: [placaB1._id], startDate: now, endDate: future, valorTotal: 2200 });
  const contratoB = await Contrato.create({ _id: oid(), empresaId: empB._id, status: 'ativo', piId: piB._id, clienteId: clienteB._id });
  const aluguelB = await Aluguel.create({ _id: oid(), empresaId: empB._id, placaId: placaB1._id, clienteId: clienteB._id, startDate: now, endDate: future, valor_mensal: 2200 });
  const temporalB = await Temporal.create({ _id: oid(), empresaId: empB._id, plateId: String(placaB1._id), sourceType: 'CONTRACT', sourceId: String(contratoB._id), status: 'ACTIVE', startDate: now, endDate: future });
  await ApiKey.create({ _id: oid(), empresaId: empB._id, key: keyB, active: true, scopes: ['catalog:read', 'inventory:read', 'inventory:availability', 'geo:read'] });

  await mongoose.disconnect();

  // ── Print checklist ───────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       STAGING MULTI-TENANT SEED — CHECKLIST DE 36 CENÁRIOS  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('CREDENCIAIS:');
  console.log(`  Empresa Alpha ID : ${empA._id}`);
  console.log(`  Empresa Beta  ID : ${empB._id}`);
  console.log(`  API Key Alpha    : ${keyA}`);
  console.log(`  API Key Beta     : ${keyB}\n`);

  const checklist = [
    // Dashboard
    { area: 'Dashboard', test: 'GET /api/dashboard com token Alpha → retorna apenas placas Alpha (2 placas)' },
    { area: 'Dashboard', test: 'GET /api/dashboard com token Beta → retorna apenas placas Beta (2 placas)' },
    { area: 'Dashboard', test: 'GET /api/dashboard/regional com token Alpha → regiões de Alpha apenas' },
    // Inventory
    { area: 'Inventory', test: 'GET /api/inventory com token Alpha → lista placas Alpha (ALPHA-001, ALPHA-002)' },
    { area: 'Inventory', test: 'GET /api/inventory com token Beta → NÃO retorna placas Alpha' },
    { area: 'Inventory', test: 'GET /api/inventory/:id de placa Alpha com token Beta → 404' },
    // Contracts
    { area: 'Contracts', test: 'GET /api/contratos com token Alpha → retorna contrato Alpha' },
    { area: 'Contracts', test: 'GET /api/contratos com token Beta → NÃO retorna contrato Alpha' },
    { area: 'Contracts', test: `GET /api/contratos/${contratoA._id} com token Beta → 403 ou 404` },
    // PI
    { area: 'PI', test: 'GET /api/pis com token Alpha → retorna PI Alpha' },
    { area: 'PI', test: 'GET /api/pis com token Beta → NÃO retorna PI Alpha' },
    { area: 'PI', test: `DELETE /api/pis/${piA._id} com token Beta → 403 ou 404` },
    // Temporal
    { area: 'Temporal', test: 'GET /api/temporal/reservations com token Alpha → reservas Alpha apenas' },
    { area: 'Temporal', test: 'GET /api/temporal/reservations com token Beta → NÃO retorna reservas Alpha' },
    { area: 'Temporal', test: 'POST /api/temporal/backfill com empresaId Alpha → processa apenas Alpha' },
    // WhatsApp
    { area: 'WhatsApp', test: 'GET /api/whatsapp/templates com token Alpha → templates Alpha' },
    { area: 'WhatsApp', test: `DELETE /api/whatsapp/templates/:id de Alpha com token Beta → 403 ou 404` },
    // Public API
    { area: 'Public API', test: `GET /api/public/placas com x-api-key=${keyA.substring(0,20)}... → apenas ALPHA-001, ALPHA-002` },
    { area: 'Public API', test: `GET /api/public/placas com x-api-key=${keyB.substring(0,20)}... → apenas BETA-001, BETA-002` },
    { area: 'Public API', test: 'Headers: Vary: x-api-key presente em ambas as respostas' },
    { area: 'Public API', test: 'Headers: Cache-Control: private, max-age=60 presente' },
    { area: 'Public API', test: `GET /api/public/placas?apiKey=${keyA.substring(0,10)} → 400 (query string rejeitada)` },
    { area: 'Public API', test: 'GET /public/v1/catalog com x-api-key Alpha → dados Alpha apenas' },
    // Diagnostics
    { area: 'Diagnostics', test: 'GET /api/diagnostics com token Alpha → informações de Alpha' },
    { area: 'Diagnostics', test: 'GET /api/diagnostics NÃO vaza empresaId de Beta' },
    // Scheduler
    { area: 'Scheduler', test: 'POST /api/temporal/scheduler/run com empresaId Alpha → processa apenas Alpha' },
    { area: 'Scheduler', test: 'Cron PIService.updateVencidas → processa por empresa, sem mistura' },
    // Realtime
    { area: 'Realtime', test: 'SSE Alpha: eventos de Alpha chegam no cliente Alpha' },
    { area: 'Realtime', test: 'SSE Alpha: eventos de Beta NÃO chegam no cliente Alpha' },
    { area: 'Realtime', test: 'SSE Beta: eventos de Alpha NÃO chegam no cliente Beta' },
    { area: 'Realtime', test: 'Reconnect: cliente Alpha reconecta e continua vendo apenas Alpha' },
    // Cache
    { area: 'Cache', test: 'Redis cache de imagens: placa Alpha não é servida para request de Beta' },
    { area: 'Cache', test: 'Read models de Dashboard: Alpha e Beta têm snapshots separados' },
    // Projections
    { area: 'Projections', test: 'commercialAvailabilityProjection para placaId Alpha com empresaId Beta → erro ou dados neutros' },
    { area: 'Projections', test: 'Dashboard regional Alpha: lookup de placas valida placa.empresaId == Alpha' },
  ];

  let i = 1;
  let currentArea = '';
  for (const item of checklist) {
    if (item.area !== currentArea) {
      console.log(`\n── ${item.area} ──`);
      currentArea = item.area;
    }
    console.log(`  ${String(i).padStart(2, '0')}. [ ] ${item.test}`);
    i++;
  }

  console.log(`\nTotal: ${checklist.length} cenários\n`);
  console.log('Após validar todos os cenários e marcar como ✅, executar:');
  console.log('  ts-node scripts/staging-seed-multitenant.ts --cleanup\n');
}

async function cleanup() {
  await mongoose.connect(MONGODB_URI!);
  const collections = ['empresas', 'placas', 'regiaos', 'clientes', 'alugueis', 'propostainternas', 'contratos', 'temporalreservations', 'publicapikeys'];
  for (const coll of collections) {
    const res = await mongoose.connection.collection(coll).deleteMany({ nome: /Alpha|Beta.*Staging/i } as any).catch(() => null);
    if (res) console.log(`  🗑  ${coll}: ${res.deletedCount} docs removidos`);
  }
  // Also cleanup by slug
  await mongoose.connection.collection('empresas').deleteMany({ slug: { $in: ['alpha-staging', 'beta-staging'] } });
  await mongoose.disconnect();
  console.log('✅  Cleanup concluído');
}

seed().catch((err) => {
  console.error('❌  Erro no seed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
