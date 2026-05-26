import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Region from '../Region';
import { regionService } from '../region.service';
import Placa from '@modules/placas/Placa';
import TemporalReservation from '@modules/temporal/TemporalReservation';
import TemporalEvent from '@modules/temporal/TemporalEvent';
import { temporalEngine } from '@modules/temporal';
import { OperationRecord } from '@modules/operations/services/operations-v4.service';
import { AlertRecord } from '@modules/alerts/services/alerts-v4.service';

describe('Region Manager V4.1', () => {
  let mongo: MongoMemoryServer;
  let empresaId: string;
  let otherEmpresaId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    empresaId = new Types.ObjectId().toString();
    otherEmpresaId = new Types.ObjectId().toString();
  });

  async function createRegion(name = 'Centro', code = 'CENTRO', tenant = empresaId) {
    return regionService.createRegion({ empresaId: tenant, name, code });
  }

  async function createPlate(regionId: string, overrides: Record<string, unknown> = {}) {
    return Placa.create({
      empresaId,
      numero_placa: `PL-${new Types.ObjectId().toString().slice(-5)}`,
      regiaoId: regionId,
      regionId,
      disponivel: true,
      ...overrides,
    });
  }

  it('cria regiao', async () => {
    const region = await createRegion();
    expect(region.name).toBe('Centro');
    expect(region.code).toBe('CENTRO');
    expect(region.status).toBe('ACTIVE');
  });

  it('impede code duplicado por empresa', async () => {
    await createRegion('Centro', 'CENTRO');
    await expect(createRegion('Centro 2', 'CENTRO')).rejects.toThrow('Ja existe uma regiao');
  });

  it('permite mesmo code em empresas diferentes', async () => {
    await createRegion('Centro', 'CENTRO', empresaId);
    const other = await createRegion('Centro', 'CENTRO', otherEmpresaId);
    expect(other.code).toBe('CENTRO');
  });

  it('edita regiao', async () => {
    const region = await createRegion();
    const updated = await regionService.updateRegion(region.id, { empresaId, name: 'Sul', code: 'SUL' });
    expect(updated.name).toBe('Sul');
    expect(updated.code).toBe('SUL');
  });

  it('arquiva regiao', async () => {
    const region = await createRegion();
    const archived = await regionService.archiveRegion(region.id, empresaId);
    expect(archived.status).toBe('ARCHIVED');
  });

  it('impede attach de placa em regiao arquivada', async () => {
    const region = await createRegion();
    const legacy = await createRegion('Legado', 'LEGADO');
    const plate = await createPlate(legacy.id);
    await regionService.archiveRegion(region.id, empresaId);
    await expect(regionService.attachPlateToRegion(String(plate._id), region.id, empresaId)).rejects.toThrow('Regiao arquivada');
  });

  it('attach plate to region', async () => {
    const region = await createRegion();
    const legacy = await createRegion('Legado', 'LEGADO');
    const plate = await createPlate(legacy.id);
    const attached = await regionService.attachPlateToRegion(String(plate._id), region.id, empresaId, 'Lote A');
    expect(String((attached as any).regionId)).toBe(region.id);
    expect((attached as any).regionalLot).toBe('Lote A');
    expect((attached as any).loteRegional).toBe('Lote A');
  });

  it('detach plate from region', async () => {
    const region = await createRegion();
    const plate = await createPlate(region.id);
    const detached = await regionService.detachPlateFromRegion(String(plate._id), empresaId);
    expect((detached as any).regionId).toBeUndefined();
    expect(String((detached as any).regiaoId)).toBe(region.id);
  });

  it('lista regioes por empresa', async () => {
    await createRegion('Centro', 'CENTRO', empresaId);
    await createRegion('Outra', 'OUTRA', otherEmpresaId);
    const regions = await regionService.listRegions({ empresaId });
    expect(regions).toHaveLength(1);
    expect(regions[0].code).toBe('CENTRO');
  });

  it('getRegionSummary com placas vinculadas', async () => {
    const region = await createRegion();
    const plate = await createPlate(region.id);
    await TemporalReservation.create({
      empresaId,
      plateId: plate._id,
      sourceType: 'CONTRACT',
      sourceId: new Types.ObjectId().toString(),
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
      status: 'ACTIVE',
    });

    const summary = await regionService.getRegionSummary(region.id, empresaId, new Date('2026-06-15'));
    expect(summary.totalPlates).toBe(1);
    expect(summary.contractedPlates).toBe(1);
    expect(summary.occupancyRate).toBe(100);
  });

  it('dashboard usa regiao formal antes de legado', async () => {
    const formal = await createRegion('Formal', 'FORMAL');
    const legacy = await createRegion('Legado', 'LEGADO');
    await createPlate(legacy.id, { regionId: formal.id });

    const summary = await temporalEngine.getTemporalDashboardSummary(empresaId, new Date('2026-06-15'));
    expect(summary.occupancyByRegion.find((region: any) => region.regionId === formal.id)?.name).toBe('Formal');
    expect(summary.occupancyByRegion.find((region: any) => region.regionId === legacy.id)).toBeUndefined();
  });

  it('migrateLegacyPlateRegions e idempotente', async () => {
    const legacy = await Region.create({
      empresaId,
      nome: 'Legacy Centro',
      codigo: 'LEGACY-CENTRO',
      name: 'Legacy Centro',
      code: 'LEGACY-CENTRO',
      ativo: true,
      status: 'ACTIVE',
    });
    const plate = await Placa.create({
      empresaId,
      numero_placa: 'LEG-1',
      regiaoId: legacy._id,
      loteRegional: 'Lote legado',
      disponivel: true,
    });
    await Placa.updateOne({ _id: plate._id }, { $unset: { regionId: '' } });

    const first = await regionService.migrateLegacyPlateRegions(empresaId);
    const second = await regionService.migrateLegacyPlateRegions(empresaId);
    expect(first.platesUpdated).toBe(1);
    expect(second.platesUpdated).toBe(0);
    expect(second.platesSkipped).toBe(1);
  });

  it('migrate cria regioes a partir de campo legado', async () => {
    const fallback = await createRegion('Fallback', 'FALLBACK');
    const plate = await createPlate(fallback.id, { regionId: undefined, regiaoId: fallback.id, loteRegional: 'Zona Norte' });
    await Placa.updateOne({ _id: plate._id }, { $unset: { regionId: '' } });

    const report = await regionService.migrateLegacyPlateRegions(empresaId);
    const updated = await Placa.findById(plate._id).lean();
    expect(report.platesUpdated).toBe(1);
    expect((updated as any).regionId).toBeDefined();
  });

  it('migrate nao remove campos antigos', async () => {
    const legacy = await createRegion('Legacy', 'LEGACY');
    const plate = await createPlate(legacy.id, { regionId: undefined, loteRegional: 'Lote 1' });
    await Placa.updateOne({ _id: plate._id }, { $unset: { regionId: '' } });

    await regionService.migrateLegacyPlateRegions(empresaId);
    const updated = await Placa.findById(plate._id).lean();
    expect((updated as any).regiaoId).toBeDefined();
    expect((updated as any).loteRegional).toBe('Lote 1');
  });

  it('region summary nao inventa alertas', async () => {
    const region = await createRegion();
    await createPlate(region.id);
    const summary = await regionService.getRegionSummary(region.id, empresaId);
    expect(summary.alertsCount).toBe(0);

    await TemporalEvent.create({
      empresaId,
      eventType: 'TEMPORAL_RESERVATION_CONFLICT',
      message: 'Conflito',
      metadata: {},
    });
    const after = await regionService.getRegionSummary(region.id, empresaId);
    expect(after.alertsCount).toBe(0);
  });

  it('getRegionSummary inclui metricas operacionais reais', async () => {
    const region = await createRegion();
    const plate = await createPlate(region.id);
    await OperationRecord.create({
      empresaId,
      kind: 'task',
      title: 'Instalacao pendente',
      domain: 'operations',
      priority: 'critical',
      status: 'pending',
      dueDate: new Date('2026-06-10'),
      payload: { plateId: String(plate._id), type: 'installation' },
    });
    await TemporalReservation.create({
      empresaId,
      plateId: plate._id,
      sourceType: 'CONTRACT',
      sourceId: 'contract-ending',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-20'),
      status: 'ACTIVE',
    });

    const summary = await regionService.getRegionSummary(region.id, empresaId, new Date('2026-06-15'));
    expect(summary.pendingInstallations).toBe(1);
    expect(summary.operationalBacklog).toBeGreaterThanOrEqual(1);
    expect(summary.endingContracts).toBe(1);
    expect(summary.nextDueOperation?.type).toBe('INSTALLATION');
    expect(summary.overdueOperations).toBe(1);
    expect(summary.slaHealth).toBe('CRITICAL');
    expect(summary.criticalBacklog).toBe(1);
    expect(summary.nextSlaDueAt).toBeNull();
  });

  it('regiao sem operacoes retorna zero e null honestos', async () => {
    const region = await createRegion();
    await createPlate(region.id);
    const summary = await regionService.getRegionSummary(region.id, empresaId);
    expect(summary.pendingInstallations).toBe(0);
    expect(summary.pendingScrapings).toBe(0);
    expect(summary.pendingMaintenances).toBe(0);
    expect(summary.operationalBacklog).toBe(0);
    expect(summary.nextDueOperation).toBeNull();
    expect(summary.lastOperationAt).toBeNull();
  });

  it('endpoint service operations retorna apenas operacoes de placas da regiao e tenant', async () => {
    const region = await createRegion();
    const otherRegion = await createRegion('Outra', 'OUTRA');
    const plate = await createPlate(region.id, { numero_placa: 'REG-1', localizacao: 'Rua A' });
    const otherPlate = await createPlate(otherRegion.id, { numero_placa: 'OUT-1' });
    await OperationRecord.create([
      {
        empresaId,
        kind: 'task',
        title: 'Raspagem',
        domain: 'operations',
        priority: 'high',
        status: 'pending',
        dueDate: new Date('2026-06-20'),
        payload: { plateId: String(plate._id), type: 'scraping' },
      },
      {
        empresaId,
        kind: 'task',
        title: 'Manutencao fora',
        domain: 'operations',
        priority: 'critical',
        status: 'pending',
        dueDate: new Date('2026-06-01'),
        payload: { plateId: String(otherPlate._id), type: 'maintenance' },
      },
      {
        empresaId: otherEmpresaId,
        kind: 'task',
        title: 'Outro tenant',
        domain: 'operations',
        priority: 'critical',
        status: 'pending',
        payload: { plateId: String(plate._id), type: 'block' },
      },
    ]);

    const data = await regionService.getRegionOperations(region.id, empresaId, new Date('2026-06-15'));
    expect(data.items).toHaveLength(1);
    const item = data.items[0]!;
    expect(item.type).toBe('SCRAPING');
    expect(item.plateNumber).toBe('REG-1');
    expect(item.slaStatus).toBe('ON_TRACK');
    expect(item.referenceDueAt).toBe('2026-06-20T00:00:00.000Z');
  });

  it('endpoint service operations ordena por prioridade e prazo', async () => {
    const region = await createRegion();
    const plate = await createPlate(region.id);
    await OperationRecord.create([
      {
        empresaId,
        kind: 'task',
        title: 'Baixa antes',
        domain: 'operations',
        priority: 'low',
        status: 'pending',
        dueDate: new Date('2026-06-01'),
        payload: { plateId: String(plate._id), type: 'maintenance' },
      },
      {
        empresaId,
        kind: 'task',
        title: 'Critica depois',
        domain: 'operations',
        priority: 'critical',
        status: 'pending',
        dueDate: new Date('2026-06-30'),
        payload: { plateId: String(plate._id), type: 'installation' },
      },
    ]);

    const data = await regionService.getRegionOperations(region.id, empresaId);
    expect(data.items[0]!.priority).toBe('CRITICAL');
  });

  it('RegionService usa plateId canonico e mantem fallback legacy', async () => {
    const region = await createRegion();
    const plate = await createPlate(region.id);
    await OperationRecord.create([
      {
        empresaId,
        kind: 'task',
        title: 'Canonica',
        domain: 'operations',
        priority: 'medium',
        status: 'pending',
        payload: { plateId: String(plate._id), operationType: 'INSTALLATION' },
      },
      {
        empresaId,
        kind: 'task',
        title: 'Legada board',
        domain: 'operations',
        priority: 'low',
        status: 'pending',
        payload: { boardId: String(plate._id), type: 'inspection' },
      },
    ]);

    const data = await regionService.getRegionOperations(region.id, empresaId);
    expect(data.items.map((item) => item.plateId)).toEqual([String(plate._id), String(plate._id)]);
    expect(data.summary.total).toBe(2);
  });

  it('alertas regionais respeitam regiao e tenant', async () => {
    const region = await createRegion();
    const otherRegion = await createRegion('Outra', 'OUTRA');
    const plate = await createPlate(region.id);
    const otherPlate = await createPlate(otherRegion.id);
    await AlertRecord.create([
      {
        empresaId,
        type: 'manual',
        severity: 'critical',
        message: 'Alerta da regiao',
        domain: 'regions',
        status: 'open',
        read: false,
        payload: { plateId: String(plate._id) },
      },
      {
        empresaId,
        type: 'manual',
        severity: 'critical',
        message: 'Alerta fora',
        domain: 'regions',
        status: 'open',
        read: false,
        payload: { plateId: String(otherPlate._id) },
      },
      {
        empresaId: otherEmpresaId,
        type: 'manual',
        severity: 'critical',
        message: 'Outro tenant',
        domain: 'regions',
        status: 'open',
        read: false,
        payload: { plateId: String(plate._id) },
      },
    ]);

    const data = await regionService.getRegionAlerts(region.id, empresaId);
    expect(data.items).toHaveLength(1);
    expect(data.summary.critical).toBe(1);
    expect(data.items[0]!.message).toBe('Alerta da regiao');
  });
});
