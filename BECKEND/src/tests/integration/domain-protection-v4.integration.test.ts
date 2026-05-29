import request from 'supertest';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import config from '@config/config';
import Aluguel from '@modules/alugueis/Aluguel';
import Cliente from '@modules/clientes/Cliente';
import Contrato from '@modules/contratos/Contrato';
import { OperationalContractService } from '@modules/contratos/services/operational-contract.service';
import Empresa from '@modules/empresas/Empresa';
import Placa from '@modules/placas/Placa';
import placasRoutes from '@modules/placas/placas.routes';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import LegacyPIService from '@modules/propostas-internas/pi.service';
import Regiao from '@modules/regioes/Regiao';
import { DashboardService } from '@modules/dashboard/dashboard.service';
import { InventoryBoardsService } from '@modules/inventory/services/inventory-boards.service';
import { InventorySummaryService } from '@modules/inventory/services/inventory-summary.service';
import { commercialAvailabilityProjection } from '@modules/commercial-availability';
import { publicApiKeyManager } from '@modules/public-api/managers/public-api-key.manager';
import { PublicApiRepository } from '@modules/public-api/repositories/public-api.repository';
import { listPlacas as listPublicPlacas } from '@modules/public-plates/public-plates.service';
import { temporalEngine, TemporalReservation } from '@modules/temporal';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

let mongo: MongoMemoryServer;

async function createEmpresa(overrides: Record<string, unknown> = {}) {
  return Empresa.create({
    _id: new Types.ObjectId(),
    nome: `Empresa Protecao ${new Types.ObjectId().toString().slice(-4)}`,
    cnpj: `${Date.now()}${Math.floor(Math.random() * 1000000)}`.slice(0, 14).padEnd(14, '0'),
    ativo: true,
    ...overrides,
  });
}

async function createRegiao(overrides: Record<string, unknown>) {
  return Regiao.create({
    nome: 'Regiao Protecao',
    codigo: `REG-${new Types.ObjectId().toString().slice(-4)}`,
    ativo: true,
    ...overrides,
  });
}

async function createPlaca(regiaoId: string, overrides: Record<string, unknown>) {
  return Placa.create({
    numero_placa: `PL-${new Types.ObjectId().toString().slice(-6)}`,
    disponivel: true,
    regiaoId: new Types.ObjectId(regiaoId),
    localizacao: 'Rua de Protecao, 100',
    ...overrides,
  });
}

async function createPublicEmpresa(prefix: string, secret: string) {
  return createEmpresa({
    api_key_prefix: prefix,
    api_key_hash: await bcrypt.hash(secret, 10),
  });
}

function generateToken(empresaId: string) {
  return jwt.sign({
    id: new Types.ObjectId().toString(),
    empresaId,
    role: 'admin',
    email: 'domain-protection@inmidia.test',
    username: 'domain-protection',
  }, config.jwtSecret, { expiresIn: '1h' });
}

function createPlacasRouteApp() {
  const localApp = express();
  localApp.use(express.json());
  localApp.use('/api/v1/placas', placasRoutes);
  localApp.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.status || 500).json({
      success: false,
      error: error?.message || 'Erro interno',
      code: error?.code || 'INTERNAL_ERROR',
    });
  });
  return localApp;
}

describe('Domain protection V4.1', () => {
  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    process.env.REDIS_HOST = '';
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    publicApiKeyManager.clearCache();
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  describe('Grupo A - disponibilidade derivada', () => {
    it('resolve placa livre como AVAILABLE via Temporal Engine', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      const placa = await createPlaca(String(regiao._id), { empresaId: empresa._id, disponivel: true });

      await expect(temporalEngine.resolvePlateTemporalStatus(String(placa._id), date('2026-06-15'), String(empresa._id)))
        .resolves.toBe('AVAILABLE');
    });

    it('resolve placa reservada por PI como RESERVED_FUTURE', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      const placa = await createPlaca(String(regiao._id), { empresaId: empresa._id, disponivel: true });

      await temporalEngine.createTemporalReservation({
        empresaId: String(empresa._id),
        plateId: String(placa._id),
        sourceType: 'PI',
        sourceId: 'PI-PROTECTION',
        startDate: date('2026-06-01'),
        endDate: date('2026-06-30'),
      });

      await expect(temporalEngine.resolvePlateTemporalStatus(String(placa._id), date('2026-06-15'), String(empresa._id)))
        .resolves.toBe('RESERVED_FUTURE');
    });

    it('resolve placa com contrato ativo como CONTRACTED_ACTIVE', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      const placa = await createPlaca(String(regiao._id), { empresaId: empresa._id, disponivel: true });

      await temporalEngine.createTemporalReservation({
        empresaId: String(empresa._id),
        plateId: String(placa._id),
        sourceType: 'CONTRACT',
        sourceId: 'CONTRACT-PROTECTION',
        startDate: date('2026-06-01'),
        endDate: date('2026-06-30'),
        status: 'ACTIVE',
      });

      await expect(temporalEngine.resolvePlateTemporalStatus(String(placa._id), date('2026-06-15'), String(empresa._id)))
        .resolves.toBe('CONTRACTED_ACTIVE');
    });

    it('bloqueia disponibilidade em reserva futura sobreposta', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      const placa = await createPlaca(String(regiao._id), { empresaId: empresa._id, disponivel: true });

      await temporalEngine.createTemporalReservation({
        empresaId: String(empresa._id),
        plateId: String(placa._id),
        sourceType: 'PI',
        sourceId: 'PI-FUTURE',
        startDate: date('2026-08-01'),
        endDate: date('2026-08-31'),
      });

      const availability = await temporalEngine.checkPlateAvailability(
        String(placa._id),
        date('2026-08-15'),
        date('2026-08-20'),
        { empresaId: String(empresa._id) },
      );

      expect(availability.available).toBe(false);
      expect(availability.conflicts[0]?.conflictingReservation.sourceType).toBe('PI');
    });

    it('resolve placa em manutencao fisica como MAINTENANCE', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      const placa = await createPlaca(String(regiao._id), { empresaId: empresa._id, disponivel: false });

      await expect(temporalEngine.resolvePlateTemporalStatus(String(placa._id), date('2026-06-15'), String(empresa._id)))
        .resolves.toBe('MAINTENANCE');
    });
  });

  describe('Grupo B - Inventory nao vira fonte comercial', () => {
    it('updateBoard nao deve alterar status comercial temporal de contrato ativo', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      const placa = await createPlaca(String(regiao._id), { empresaId: empresa._id, disponivel: true });
      const service = new InventoryBoardsService();

      await temporalEngine.createTemporalReservation({
        empresaId: String(empresa._id),
        plateId: String(placa._id),
        sourceType: 'CONTRACT',
        sourceId: 'CONTRACT-INVENTORY',
        startDate: date('2026-06-01'),
        endDate: date('2026-06-30'),
        status: 'ACTIVE',
      });

      await service.updateBoard(String(empresa._id), String(placa._id), {
        endereco: 'Rua Operacional Atualizada',
        disponivel: false,
      });

      await expect(temporalEngine.resolvePlateTemporalStatus(String(placa._id), date('2026-06-15'), String(empresa._id)))
        .resolves.toBe('CONTRACTED_ACTIVE');
    });

    it('createBoard nao cria reservas temporais nem estado comercial implicito', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      const service = new InventoryBoardsService();

      const board = await service.createBoard(String(empresa._id), {
        codigo: 'INV-CREATE-001',
        regiaoId: String(regiao._id),
        disponivel: false,
      });

      const reservations = await TemporalReservation.find({ plateId: board.id }).lean();
      expect(reservations).toHaveLength(0);
    });

    it('toggleAvailability nao deve criar, cancelar ou reclassificar reservas temporais', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      const placa = await createPlaca(String(regiao._id), { empresaId: empresa._id, disponivel: true });
      const service = new InventoryBoardsService();

      await temporalEngine.createTemporalReservation({
        empresaId: String(empresa._id),
        plateId: String(placa._id),
        sourceType: 'CONTRACT',
        sourceId: 'CONTRACT-TOGGLE',
        startDate: date('2026-06-01'),
        endDate: date('2026-06-30'),
        status: 'ACTIVE',
      });

      await service.toggleAvailability(String(empresa._id), String(placa._id));

      const reservations = await TemporalReservation.find({ plateId: placa._id }).lean();
      const availability = await temporalEngine.checkPlateAvailability(
        String(placa._id),
        date('2026-06-15'),
        date('2026-06-20'),
        { empresaId: String(empresa._id) },
      );

      expect(reservations).toHaveLength(1);
      expect(reservations[0]?.status).toBe('ACTIVE');
      expect(availability.available).toBe(false);
    });
  });

  describe('Grupo C - Dashboard protegido contra Placa.disponivel como fonte principal', () => {
    it('KPIs de disponibilidade devem seguir projection/Temporal, nao count de Placa.disponivel', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      const placaLivre = await createPlaca(String(regiao._id), {
        empresaId: empresa._id,
        numero_placa: 'DASH-FREE',
        disponivel: true,
      });
      const placaContratada = await createPlaca(String(regiao._id), {
        empresaId: empresa._id,
        numero_placa: 'DASH-CONTRACT',
        disponivel: true,
      });

      await temporalEngine.createTemporalReservation({
        empresaId: String(empresa._id),
        plateId: String(placaContratada._id),
        sourceType: 'CONTRACT',
        sourceId: 'CONTRACT-DASH',
        startDate: date('2026-06-01'),
        endDate: date('2026-06-30'),
        status: 'ACTIVE',
      });

      const temporalSummary = await temporalEngine.getTemporalDashboardSummary(String(empresa._id), date('2026-06-15'));
      const dashboard = new DashboardService(Placa, Aluguel, Regiao, PropostaInterna, Contrato);
      const overview = await dashboard.getOverview(String(empresa._id));

      expect(overview.isSuccess).toBe(true);
      expect(temporalSummary.availablePlates).toBe(1);
      expect(overview.value.placasDisponiveis).toBe(temporalSummary.availablePlates);
      expect(String(placaLivre._id)).toEqual(expect.any(String));
    });

    it('Inventory Summary deve usar projection comercial, nao Placa.disponivel', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      const placa = await createPlaca(String(regiao._id), {
        empresaId: empresa._id,
        numero_placa: 'SUM-CONTRACT',
        disponivel: false,
      });

      await temporalEngine.createTemporalReservation({
        empresaId: String(empresa._id),
        plateId: String(placa._id),
        sourceType: 'CONTRACT',
        sourceId: 'CONTRACT-SUMMARY',
        startDate: date('2026-05-01'),
        endDate: date('2026-06-30'),
        status: 'ACTIVE',
      });

      const summary = await new InventorySummaryService().getSummary(String(empresa._id));

      expect(summary.totals.occupiedBoards).toBe(1);
      expect(summary.totals.maintenanceBoards).toBe(0);
      expect(summary.statusDistribution.find((item) => item.status === 'occupied')?.count).toBe(1);
    });
  });

  describe('Grupo D - Public API nao vaza campos comerciais internos', () => {
    it('payload publico omite cliente, contrato, valor_mensal e flags de aluguel', async () => {
      process.env.PUBLIC_API_BASE_URL = 'https://public.example.test';
      const prefix = 'domainpub';
      const secret = 'secret-domain';
      const empresa = await createPublicEmpresa(prefix, secret);
      const regiao = await createRegiao({ empresaId: empresa._id, nome: 'Centro Publico' });
      const placa = await createPlaca(String(regiao._id), {
        empresaId: empresa._id,
        numero_placa: 'PUB-DOMAIN-001',
        statusComercial: 'OCCUPIED',
        valor_mensal: 12345,
      });

      await Placa.collection.updateOne(
        { _id: placa._id },
        {
          $set: {
            clienteId: new Types.ObjectId(),
            contratoId: new Types.ObjectId(),
            aluguel_ativo: true,
            aluguel_futuro: true,
          },
        },
      );

      const res = await listPublicPlacas(String(empresa._id), {}, { page: 1, limit: 10 });

      expect(res.data).toHaveLength(1);
      expect(res.data[0]).not.toHaveProperty('cliente');
      expect(res.data[0]).not.toHaveProperty('clienteId');
      expect(res.data[0]).not.toHaveProperty('contrato');
      expect(res.data[0]).not.toHaveProperty('contratoId');
      expect(res.data[0]).not.toHaveProperty('valor_mensal');
      expect(res.data[0]).not.toHaveProperty('aluguel_ativo');
      expect(res.data[0]).not.toHaveProperty('aluguel_futuro');
    });

    it('payload publico deriva disponibilidade da projection, nao de statusComercial legado', async () => {
      process.env.PUBLIC_API_BASE_URL = 'https://public.example.test';
      const empresa = await createPublicEmpresa('domainpub2', 'secret-domain2');
      const regiao = await createRegiao({ empresaId: empresa._id, nome: 'Centro Temporal' });
      const placa = await createPlaca(String(regiao._id), {
        empresaId: empresa._id,
        numero_placa: 'PUB-TEMPORAL-001',
        statusComercial: 'AVAILABLE',
        disponivel: false,
      });

      await temporalEngine.createTemporalReservation({
        empresaId: String(empresa._id),
        plateId: String(placa._id),
        sourceType: 'CONTRACT',
        sourceId: 'CONTRACT-PUBLIC',
        startDate: date('2026-05-01'),
        endDate: date('2026-06-30'),
        status: 'ACTIVE',
      });

      const result = await listPublicPlacas(String(empresa._id), {}, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      const payload = result.data[0]!;
      expect(payload.status).toBe('ocupado');
      expect(payload.disponibilidade).toBe('ocupado');
      expect(payload).not.toHaveProperty('valor_mensal');
    });
  });

  describe('Grupo E - tenant isolation', () => {
    it('reservas e disponibilidade temporal nao se misturam entre empresas', async () => {
      const empresaA = await createEmpresa();
      const empresaB = await createEmpresa();
      const regiaoA = await createRegiao({ empresaId: empresaA._id });
      const regiaoB = await createRegiao({ empresaId: empresaB._id });
      const placaA = await createPlaca(String(regiaoA._id), { empresaId: empresaA._id });
      const placaB = await createPlaca(String(regiaoB._id), { empresaId: empresaB._id });

      await temporalEngine.createTemporalReservation({
        empresaId: String(empresaA._id),
        plateId: String(placaA._id),
        sourceType: 'CONTRACT',
        sourceId: 'CONTRACT-A',
        startDate: date('2026-06-01'),
        endDate: date('2026-06-30'),
        status: 'ACTIVE',
      });

      const availabilityA = await temporalEngine.checkPlateAvailability(
        String(placaA._id),
        date('2026-06-15'),
        date('2026-06-20'),
        { empresaId: String(empresaA._id) },
      );
      const availabilityB = await temporalEngine.checkPlateAvailability(
        String(placaB._id),
        date('2026-06-15'),
        date('2026-06-20'),
        { empresaId: String(empresaB._id) },
      );

      expect(availabilityA.available).toBe(false);
      expect(availabilityB.available).toBe(true);
      await expect(temporalEngine.resolvePlateTemporalStatus(String(placaA._id), date('2026-06-15'), String(empresaB._id)))
        .rejects.toThrow(/nao encontrada/i);
    });

    it('consulta publica com API key de uma empresa nao vaza placas de outra', async () => {
      const empresaA = await createPublicEmpresa('tenantA', 'secret-a');
      const empresaB = await createPublicEmpresa('tenantB', 'secret-b');
      const regiaoA = await createRegiao({ empresaId: empresaA._id });
      const regiaoB = await createRegiao({ empresaId: empresaB._id });
      await createPlaca(String(regiaoA._id), { empresaId: empresaA._id, numero_placa: 'TENANT-A-001' });
      await createPlaca(String(regiaoB._id), { empresaId: empresaB._id, numero_placa: 'TENANT-B-001' });

      const res = await listPublicPlacas(String(empresaA._id), {}, { page: 1, limit: 10 });

      expect(res.data.map((item: any) => item.codigo)).toEqual(['TENANT-A-001']);
    });

    it('repository Public API legado aplica tenant da API key em placa e cliente', async () => {
      const empresaA = await createPublicEmpresa('legacyA', 'secret-a');
      const empresaB = await createPublicEmpresa('legacyB', 'secret-b');
      const regiaoA = await createRegiao({ empresaId: empresaA._id });
      const regiaoB = await createRegiao({ empresaId: empresaB._id });
      const clienteA = await Cliente.create({
        nome: 'Cliente A',
        cpfCnpj: `11.111.111/0001-${Math.floor(Math.random() * 90 + 10)}`,
        email: 'a@tenant.test',
        empresaId: empresaA._id,
      });
      const clienteB = await Cliente.create({
        nome: 'Cliente B',
        cpfCnpj: `22.222.222/0001-${Math.floor(Math.random() * 90 + 10)}`,
        email: 'b@tenant.test',
        empresaId: empresaB._id,
      });

      const placaA = await createPlaca(String(regiaoA._id), {
        empresaId: empresaA._id,
        numero_placa: 'PUBLIC-LEGACY-A',
        status: 'disponivel',
      });
      const placaB = await createPlaca(String(regiaoB._id), {
        empresaId: empresaB._id,
        numero_placa: 'PUBLIC-LEGACY-B',
        status: 'disponivel',
      });
      await Placa.collection.updateOne({ _id: placaA._id }, { $set: { clienteId: clienteA._id } });
      await Placa.collection.updateOne({ _id: placaB._id }, { $set: { clienteId: clienteB._id } });

      const repo = new PublicApiRepository();
      const own = await repo.getPlacaInfo('PUBLIC-LEGACY-A', 'legacyA_secret-a');
      const leaked = await repo.getPlacaInfo('PUBLIC-LEGACY-B', 'legacyA_secret-a');

      expect(own.isSuccess).toBe(true);
      expect(own.value.cliente?.nome).toBe('Cliente A');
      expect(leaked.isFailure).toBe(true);
    });
  });

  describe('Grupo G - contratos API criticos', () => {
    it('documenta shape publico, inventory, dashboard, projection, PI e contratos', async () => {
      process.env.PUBLIC_API_BASE_URL = 'https://public.example.test';
      const empresa = await createPublicEmpresa('contractsapi', 'secret-contracts');
      const regiao = await createRegiao({ empresaId: empresa._id, nome: 'Contratos API' });
      const cliente = await Cliente.create({
        nome: 'Cliente Contrato API',
        cpfCnpj: `33.333.333/0001-${Math.floor(Math.random() * 90 + 10)}`,
        email: 'contrato-api@inmidia.test',
        empresaId: empresa._id,
      });
      const placa = await createPlaca(String(regiao._id), {
        empresaId: empresa._id,
        numero_placa: 'API-CONTRACT-001',
        statusComercial: 'AVAILABLE',
      });

      await PropostaInterna.create({
        empresaId: empresa._id,
        clienteId: cliente._id,
        pi_code: `PI-CONTRACT-${new Types.ObjectId().toString().slice(-6)}`,
        placas: [placa._id],
        status: 'em_andamento',
        periodType: 'custom',
        startDate: date('2026-06-01'),
        endDate: date('2026-06-30'),
        dataInicio: date('2026-06-01'),
        dataFim: date('2026-06-30'),
        valorTotal: 1500,
        descricao: 'Contrato API shape test',
      });

      const publicPayload = (await listPublicPlacas(String(empresa._id), {}, { page: 1, limit: 10 })).data[0]!;
      const inventoryPayload = (await new InventoryBoardsService().listBoards(String(empresa._id), { page: 1, limit: 10 })).boards[0]!;
      const dashboardPayload = (await new DashboardService(Placa, Aluguel, Regiao, PropostaInterna, Contrato).getOverview(String(empresa._id))).value;
      const projectionPayload = await commercialAvailabilityProjection.resolvePlateCommercialStatus({
        empresaId: String(empresa._id),
        placaId: String(placa._id),
        at: date('2026-06-15'),
      });
      const piPayload = await new LegacyPIService().getAll(String(empresa._id), { page: 1, limit: 10 });
      const contractPayload = await new OperationalContractService().getSummary(String(empresa._id));

      expect(Object.keys(publicPayload).sort()).toEqual(expect.arrayContaining([
        'id', 'slug', 'codigo', 'status', 'disponibilidade', 'imagemUrl', 'updatedAt',
      ]));
      ['empresaId', 'clienteId', 'contratoId', 'valor_mensal', 'aluguel_ativo', 'aluguel_futuro', 'statusAluguel', 'reservationId'].forEach((field) => {
        expect(publicPayload).not.toHaveProperty(field);
      });

      expect(inventoryPayload).toEqual(expect.objectContaining({
        id: expect.any(String),
        codigo: 'API-CONTRACT-001',
        disponivel: expect.any(Boolean),
        status: expect.any(String),
        commercialStatus: expect.any(String),
      }));
      expect(dashboardPayload).toEqual(expect.objectContaining({
        totalPlacas: expect.any(Number),
        placasDisponiveis: expect.any(Number),
        contratosAtivos: expect.any(Number),
      }));
      expect(projectionPayload).toEqual(expect.objectContaining({
        status: expect.any(String),
        source: expect.any(String),
        isCommerciallyAvailable: expect.any(Boolean),
        isPhysicallyBlocked: expect.any(Boolean),
      }));
      expect(piPayload).toEqual(expect.objectContaining({
        data: expect.any(Array),
        pagination: expect.objectContaining({ totalDocs: expect.any(Number) }),
      }));
      expect(contractPayload).toEqual(expect.objectContaining({
        totals: expect.any(Object),
        revenue: expect.any(Object),
        byStatus: expect.any(Array),
      }));
    });
  });

  describe('Grupo F - regressao da rota critica /placas/disponiveis', () => {
    it('GET /api/v1/placas/disponiveis responde sem 500 e preserva contrato basico', async () => {
      const empresa = await createEmpresa();
      const regiao = await createRegiao({ empresaId: empresa._id });
      await createPlaca(String(regiao._id), { empresaId: empresa._id, numero_placa: 'ROUTE-DISP-001' });
      const token = generateToken(String(empresa._id));
      const routeApp = createPlacasRouteApp();

      const res = await request(routeApp)
        .get('/api/v1/placas/disponiveis?dataInicio=2026-06-01&dataFim=2026-06-30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).not.toBe(500);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        count: expect.any(Number),
      });
    });
  });
});
