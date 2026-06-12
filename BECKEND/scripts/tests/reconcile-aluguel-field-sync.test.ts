import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Aluguel from '@modules/alugueis/Aluguel';
import Placa from '@modules/placas/Placa';
import Cliente from '@modules/clientes/Cliente';
import {
  diffAluguelFieldSync,
  reconcileAluguelFieldSync,
} from '../reconcile-aluguel-field-sync';

describe('reconcile-aluguel-field-sync', () => {
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

  async function createBaseAluguel(overrides: Record<string, unknown>) {
    const placa = await Placa.create({
      numero_placa: `RFS-${new Types.ObjectId().toString().slice(-6)}`,
      empresaId,
      regiaoId: new Types.ObjectId(),
      disponivel: true,
    });
    const cliente = await Cliente.create({ nome: 'Cliente RFS', empresaId });

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
    });

    // Force a divergence directly via raw collection write, bypassing
    // schema hooks (simulates legacy drift from findOneAndUpdate/updateMany).
    await Aluguel.collection.updateOne({ _id: aluguel._id }, { $set: overrides });

    return aluguel;
  }

  describe('diffAluguelFieldSync', () => {
    it('retorna null quando os pares ja estao sincronizados', () => {
      const doc = {
        _id: new Types.ObjectId(),
        empresaId: new Types.ObjectId(),
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
        data_inicio: new Date('2026-06-01'),
        data_fim: new Date('2026-06-30'),
      };

      expect(diffAluguelFieldSync(doc)).toBeNull();
    });

    it('detecta divergencia entre startDate e data_inicio', () => {
      const doc = {
        _id: new Types.ObjectId(),
        empresaId: new Types.ObjectId(),
        startDate: new Date('2026-07-01'),
        data_inicio: new Date('2026-06-01'),
      };

      const result = diffAluguelFieldSync(doc);
      expect(result).not.toBeNull();
      expect(result?.after.data_inicio).toEqual(new Date('2026-07-01'));
    });
  });

  describe('reconcileAluguelFieldSync', () => {
    it('dry-run (sem --fix) reporta divergencia mas nao escreve no banco', async () => {
      const aluguel = await createBaseAluguel({
        endDate: new Date('2026-07-15T00:00:00.000Z'),
        // data_fim permanece 2026-06-30 -> divergencia
      });

      const report = await reconcileAluguelFieldSync({ empresaId });

      expect(report.totalAnalyzed).toBe(1);
      expect(report.divergent).toBe(1);
      expect(report.fixed).toBe(0);

      const persisted = await Aluguel.findById(aluguel._id).lean();
      expect(persisted?.data_fim).toEqual(new Date('2026-06-30T00:00:00.000Z'));
    });

    it('--fix corrige a divergencia e e idempotente', async () => {
      const aluguel = await createBaseAluguel({
        endDate: new Date('2026-07-15T00:00:00.000Z'),
      });

      const firstRun = await reconcileAluguelFieldSync({ empresaId, fix: true });
      expect(firstRun.divergent).toBe(1);
      expect(firstRun.fixed).toBe(1);

      const persisted = await Aluguel.findById(aluguel._id).lean();
      expect(persisted?.endDate).toEqual(new Date('2026-07-15T00:00:00.000Z'));
      expect(persisted?.data_fim).toEqual(new Date('2026-07-15T00:00:00.000Z'));

      const secondRun = await reconcileAluguelFieldSync({ empresaId, fix: true });
      expect(secondRun.divergent).toBe(0);
      expect(secondRun.fixed).toBe(0);
    });

    it('e tenant-safe: nao reconcilia alugueis de outra empresa', async () => {
      await createBaseAluguel({
        endDate: new Date('2026-07-15T00:00:00.000Z'),
      });

      const outroEmpresaId = new Types.ObjectId().toString();
      const report = await reconcileAluguelFieldSync({ empresaId: outroEmpresaId, fix: true });

      expect(report.totalAnalyzed).toBe(0);
      expect(report.divergent).toBe(0);
      expect(report.fixed).toBe(0);
    });
  });
});
