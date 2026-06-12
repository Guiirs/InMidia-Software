import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Aluguel from '@modules/alugueis/Aluguel';
import Placa from '@modules/placas/Placa';
import Cliente from '@modules/clientes/Cliente';
import TemporalReservation from '@modules/temporal/TemporalReservation';
import { reconcileAluguelTemporal } from '../reconcile-aluguel-temporal';

describe('reconcile-aluguel-temporal', () => {
  let mongo: MongoMemoryServer;
  let empresaId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    empresaId = new Types.ObjectId().toString();
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function createAtivoAluguel(overrides: Record<string, unknown> = {}) {
    const placa = await Placa.create({
      numero_placa: `RAT-${new Types.ObjectId().toString().slice(-6)}`,
      empresaId,
      regiaoId: new Types.ObjectId(),
      disponivel: true,
    });
    const cliente = await Cliente.create({ nome: 'Cliente RAT', empresaId });

    const aluguel = await Aluguel.create({
      placaId: placa._id,
      clienteId: cliente._id,
      empresaId,
      periodType: 'custom',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      data_inicio: new Date('2026-06-01T00:00:00.000Z'),
      data_fim: new Date('2026-06-30T00:00:00.000Z'),
      status: 'ativo',
      ...overrides,
    });

    return { aluguel, placa };
  }

  it('dry-run reporta MISSING_RESERVATION e nao escreve no banco', async () => {
    const { aluguel } = await createAtivoAluguel();

    const report = await reconcileAluguelTemporal({ empresaId });

    expect(report.totalAnalyzed).toBe(1);
    expect(report.missingReservations).toBe(1);
    expect(report.fixed).toBe(0);

    const reservations = await TemporalReservation.find({ sourceId: String(aluguel._id) }).lean();
    expect(reservations).toHaveLength(0);
  });

  it('--fix cria a TemporalReservation ausente quando a placa esta disponivel', async () => {
    const { aluguel, placa } = await createAtivoAluguel();

    const firstRun = await reconcileAluguelTemporal({ empresaId, fix: true });
    expect(firstRun.missingReservations).toBe(1);
    expect(firstRun.fixed).toBe(1);
    expect(firstRun.conflicts).toBe(0);

    const reservations = await TemporalReservation.find({
      empresaId,
      sourceType: 'LEGACY_RENTAL',
      sourceId: String(aluguel._id),
    }).lean();

    expect(reservations).toHaveLength(1);
    expect(String(reservations[0]?.plateId)).toBe(String(placa._id));
    expect(reservations[0]?.startDate).toEqual(aluguel.startDate);
    expect(reservations[0]?.endDate).toEqual(aluguel.endDate);

    const secondRun = await reconcileAluguelTemporal({ empresaId, fix: true });
    expect(secondRun.missingReservations).toBe(0);
    expect(secondRun.fixed).toBe(0);

    const reservationsAfterSecondRun = await TemporalReservation.find({
      empresaId,
      sourceType: 'LEGACY_RENTAL',
      sourceId: String(aluguel._id),
    }).lean();
    expect(reservationsAfterSecondRun).toHaveLength(1);
  });

  it('--fix nao cria reserva quando ha conflito real (CONFLICT)', async () => {
    const { aluguel, placa } = await createAtivoAluguel();

    // Reserva concorrente ja existente para a mesma placa, mesmo periodo, outra origem.
    await TemporalReservation.create({
      empresaId,
      plateId: placa._id,
      sourceType: 'CONTRACT',
      sourceId: 'CTR-1',
      startDate: new Date('2026-06-10T00:00:00.000Z'),
      endDate: new Date('2026-06-15T00:00:00.000Z'),
      status: 'ACTIVE',
    });

    const report = await reconcileAluguelTemporal({ empresaId, fix: true });

    expect(report.conflicts).toBe(1);
    expect(report.fixed).toBe(0);
    expect(report.issues[0]?.type).toBe('CONFLICT');

    const reservations = await TemporalReservation.find({
      empresaId,
      sourceType: 'LEGACY_RENTAL',
      sourceId: String(aluguel._id),
    }).lean();
    expect(reservations).toHaveLength(0);
  });

  it('detecta DATE_MISMATCH e --fix corrige as datas da reserva', async () => {
    const { aluguel, placa } = await createAtivoAluguel();

    const reservation = await TemporalReservation.create({
      empresaId,
      plateId: placa._id,
      sourceType: 'LEGACY_RENTAL',
      sourceId: String(aluguel._id),
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T00:00:00.000Z'),
      status: 'ACTIVE',
    });

    const dryRun = await reconcileAluguelTemporal({ empresaId });
    expect(dryRun.dateMismatches).toBe(1);
    expect(dryRun.fixed).toBe(0);

    const unchanged = await TemporalReservation.findById(reservation._id).lean();
    expect(unchanged?.startDate).toEqual(new Date('2026-05-01T00:00:00.000Z'));

    const fixRun = await reconcileAluguelTemporal({ empresaId, fix: true });
    expect(fixRun.dateMismatches).toBe(1);
    expect(fixRun.fixed).toBe(1);

    const fixed = await TemporalReservation.findById(reservation._id).lean();
    expect(fixed?.startDate).toEqual(aluguel.startDate);
    expect(fixed?.endDate).toEqual(aluguel.endDate);

    const secondRun = await reconcileAluguelTemporal({ empresaId, fix: true });
    expect(secondRun.dateMismatches).toBe(0);
    expect(secondRun.fixed).toBe(0);
  });

  it('reporta TENANT_OR_PLATE_MISMATCH sem corrigir automaticamente', async () => {
    const { aluguel } = await createAtivoAluguel();
    const outraPlaca = await Placa.create({
      numero_placa: `RAT-OUTRA-${new Types.ObjectId().toString().slice(-6)}`,
      empresaId,
      regiaoId: new Types.ObjectId(),
      disponivel: true,
    });

    const reservation = await TemporalReservation.create({
      empresaId,
      plateId: outraPlaca._id,
      sourceType: 'LEGACY_RENTAL',
      sourceId: String(aluguel._id),
      startDate: aluguel.startDate,
      endDate: aluguel.endDate,
      status: 'ACTIVE',
    });

    const report = await reconcileAluguelTemporal({ empresaId, fix: true });

    expect(report.tenantOrPlateMismatches).toBe(1);
    expect(report.fixed).toBe(0);
    expect(report.issues[0]?.type).toBe('TENANT_OR_PLATE_MISMATCH');

    const unchanged = await TemporalReservation.findById(reservation._id).lean();
    expect(String(unchanged?.plateId)).toBe(String(outraPlaca._id));
  });

  it('reporta DUPLICATE quando ha multiplas reservations LEGACY_RENTAL e nunca remove', async () => {
    const { aluguel, placa } = await createAtivoAluguel();

    await TemporalReservation.create([
      {
        empresaId,
        plateId: placa._id,
        sourceType: 'LEGACY_RENTAL',
        sourceId: String(aluguel._id),
        startDate: aluguel.startDate,
        endDate: aluguel.endDate,
        status: 'ACTIVE',
      },
      {
        empresaId,
        plateId: placa._id,
        sourceType: 'LEGACY_RENTAL',
        sourceId: String(aluguel._id),
        startDate: aluguel.startDate,
        endDate: aluguel.endDate,
        status: 'ACTIVE',
      },
    ]);

    const report = await reconcileAluguelTemporal({ empresaId, fix: true });

    expect(report.duplicates).toBe(1);
    expect(report.fixed).toBe(0);
    expect(report.issues[0]?.type).toBe('DUPLICATE');
    expect(report.issues[0]?.reservationIds).toHaveLength(2);

    const reservations = await TemporalReservation.find({
      empresaId,
      sourceType: 'LEGACY_RENTAL',
      sourceId: String(aluguel._id),
    }).lean();
    expect(reservations).toHaveLength(2);
  });

  it('e tenant-safe: nao reconcilia alugueis de outra empresa', async () => {
    await createAtivoAluguel();

    const outraEmpresaId = new Types.ObjectId().toString();
    const report = await reconcileAluguelTemporal({ empresaId: outraEmpresaId, fix: true });

    expect(report.totalAnalyzed).toBe(0);
    expect(report.missingReservations).toBe(0);
    expect(report.fixed).toBe(0);
  });

  it('aluguel sem placaId => ORPHAN_ALUGUEL_PLACA_FIELD_MISSING somente com --include-orphans', async () => {
    const cliente = await Cliente.create({ nome: 'Cliente Sem Placa', empresaId });

    // Insere diretamente na colecao para contornar a validacao required do schema (placaId).
    await Aluguel.collection.insertOne({
      clienteId: cliente._id,
      empresaId: new Types.ObjectId(empresaId),
      periodType: 'custom',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      data_inicio: new Date('2026-06-01T00:00:00.000Z'),
      data_fim: new Date('2026-06-30T00:00:00.000Z'),
      status: 'ativo',
    } as any);

    const withoutFlag = await reconcileAluguelTemporal({ empresaId });
    expect(withoutFlag.orphanPlacaFieldMissing).toBe(0);
    expect(withoutFlag.totalAnalyzed).toBe(0);
    expect(withoutFlag.issues).toHaveLength(0);

    const withFlag = await reconcileAluguelTemporal({ empresaId, includeOrphans: true });
    expect(withFlag.orphanPlacaFieldMissing).toBe(1);
    expect(withFlag.totalAnalyzed).toBe(0);
    expect(withFlag.issues[0]?.type).toBe('ORPHAN_ALUGUEL_PLACA_FIELD_MISSING');
    expect(withFlag.issues[0]?.plateId).toBeNull();
  });

  it('aluguel com placaId inexistente => ORPHAN_ALUGUEL_PLACA_NOT_FOUND', async () => {
    const cliente = await Cliente.create({ nome: 'Cliente Placa Inexistente', empresaId });
    const placaInexistenteId = new Types.ObjectId();

    const aluguel = await Aluguel.create({
      placaId: placaInexistenteId,
      clienteId: cliente._id,
      empresaId,
      periodType: 'custom',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      data_inicio: new Date('2026-06-01T00:00:00.000Z'),
      data_fim: new Date('2026-06-30T00:00:00.000Z'),
      status: 'ativo',
    });

    const report = await reconcileAluguelTemporal({ empresaId, fix: true });

    expect(report.orphanPlacaNotFound).toBe(1);
    expect(report.totalAnalyzed).toBe(0);
    expect(report.missingReservations).toBe(0);
    expect(report.fixed).toBe(0);
    expect(report.issues[0]?.type).toBe('ORPHAN_ALUGUEL_PLACA_NOT_FOUND');
    expect(report.issues[0]?.plateId).toBe(String(placaInexistenteId));

    const reservations = await TemporalReservation.find({ sourceId: String(aluguel._id) }).lean();
    expect(reservations).toHaveLength(0);
  });

  it('aluguel com placa em outra empresa => ORPHAN_ALUGUEL_PLACA_TENANT_MISMATCH', async () => {
    const outraEmpresaId = new Types.ObjectId().toString();
    const placaOutraEmpresa = await Placa.create({
      numero_placa: `RAT-OUTRA-EMPRESA-${new Types.ObjectId().toString().slice(-6)}`,
      empresaId: outraEmpresaId,
      regiaoId: new Types.ObjectId(),
      disponivel: true,
    });

    const cliente = await Cliente.create({ nome: 'Cliente Tenant Mismatch', empresaId });
    const aluguel = await Aluguel.create({
      placaId: placaOutraEmpresa._id,
      clienteId: cliente._id,
      empresaId,
      periodType: 'custom',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      data_inicio: new Date('2026-06-01T00:00:00.000Z'),
      data_fim: new Date('2026-06-30T00:00:00.000Z'),
      status: 'ativo',
    });

    const report = await reconcileAluguelTemporal({ empresaId, fix: true });

    expect(report.orphanPlacaTenantMismatch).toBe(1);
    expect(report.totalAnalyzed).toBe(0);
    expect(report.missingReservations).toBe(0);
    expect(report.fixed).toBe(0);
    expect(report.issues[0]?.type).toBe('ORPHAN_ALUGUEL_PLACA_TENANT_MISMATCH');
    expect(report.issues[0]?.plateId).toBe(String(placaOutraEmpresa._id));

    const reservations = await TemporalReservation.find({ sourceId: String(aluguel._id) }).lean();
    expect(reservations).toHaveLength(0);
  });

  it('dry-run nao altera o banco para nenhum dos cenarios orfaos', async () => {
    const cliente = await Cliente.create({ nome: 'Cliente Dry Run', empresaId });
    const placaInexistenteId = new Types.ObjectId();

    await Aluguel.create({
      placaId: placaInexistenteId,
      clienteId: cliente._id,
      empresaId,
      periodType: 'custom',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      data_inicio: new Date('2026-06-01T00:00:00.000Z'),
      data_fim: new Date('2026-06-30T00:00:00.000Z'),
      status: 'ativo',
    });

    const aluguelCountBefore = await Aluguel.countDocuments({});
    const reservationCountBefore = await TemporalReservation.countDocuments({});

    const report = await reconcileAluguelTemporal({ empresaId });
    expect(report.orphanPlacaNotFound).toBe(1);
    expect(report.fixed).toBe(0);

    const aluguelCountAfter = await Aluguel.countDocuments({});
    const reservationCountAfter = await TemporalReservation.countDocuments({});
    expect(aluguelCountAfter).toBe(aluguelCountBefore);
    expect(reservationCountAfter).toBe(reservationCountBefore);
  });
});
