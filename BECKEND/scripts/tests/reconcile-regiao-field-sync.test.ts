import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Regiao from '@modules/regioes/Regiao';
import {
  diffRegiaoFieldSync,
  reconcileRegiaoFieldSync,
} from '../reconcile-regiao-field-sync';

describe('reconcile-regiao-field-sync', () => {
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

  describe('diffRegiaoFieldSync', () => {
    it('retorna null quando EN e PT ja estao sincronizados', () => {
      const doc = {
        _id: new Types.ObjectId(),
        empresaId: new Types.ObjectId(),
        name: 'Zona Sul',
        nome: 'Zona Sul',
        code: 'ZONA-SUL',
        codigo: 'ZONA-SUL',
        description: 'Regiao sul',
        descricao: 'Regiao sul',
        status: 'ACTIVE',
        ativo: true,
      };

      expect(diffRegiaoFieldSync(doc)).toBeNull();
    });

    it('deriva EN a partir do PT quando EN esta ausente (doc legado)', () => {
      const doc = {
        _id: new Types.ObjectId(),
        empresaId: new Types.ObjectId(),
        nome: 'Zona Norte',
        codigo: 'ZONA-NORTE',
        descricao: 'Regiao norte',
        ativo: true,
      };

      const result = diffRegiaoFieldSync(doc);
      expect(result).not.toBeNull();
      expect(result?.after.name).toBe('Zona Norte');
      expect(result?.after.code).toBe('ZONA-NORTE');
      expect(result?.after.description).toBe('Regiao norte');
      expect(result?.after.status).toBe('ACTIVE');
    });

    it('detecta divergencia entre status (EN) e ativo (PT)', () => {
      const doc = {
        _id: new Types.ObjectId(),
        empresaId: new Types.ObjectId(),
        name: 'Zona Leste',
        nome: 'Zona Leste',
        code: 'ZONA-LESTE',
        codigo: 'ZONA-LESTE',
        description: 'Regiao leste',
        descricao: 'Regiao leste',
        status: 'ARCHIVED',
        ativo: true,
      };

      const result = diffRegiaoFieldSync(doc);
      expect(result).not.toBeNull();
      expect(result?.after.ativo).toBe(false);
      expect(result?.after.status).toBeUndefined();
    });
  });

  describe('reconcileRegiaoFieldSync', () => {
    async function createRegiao(overrides: Record<string, unknown>) {
      const regiao = await Regiao.create({
        empresaId,
        nome: 'Zona Oeste',
        codigo: 'ZONA-OESTE',
        descricao: 'Regiao oeste',
        ativo: true,
      });

      await Regiao.collection.updateOne({ _id: regiao._id }, { $set: overrides });

      return regiao;
    }

    it('dry-run reporta divergencia mas nao escreve no banco', async () => {
      const regiao = await createRegiao({ status: 'INACTIVE' });

      const report = await reconcileRegiaoFieldSync({ empresaId });

      expect(report.totalAnalyzed).toBe(1);
      expect(report.divergent).toBe(1);
      expect(report.fixed).toBe(0);

      const persisted = await Regiao.findById(regiao._id).lean();
      expect(persisted?.ativo).toBe(true);
    });

    it('--fix corrige a divergencia e e idempotente', async () => {
      const regiao = await createRegiao({ status: 'INACTIVE' });

      const firstRun = await reconcileRegiaoFieldSync({ empresaId, fix: true });
      expect(firstRun.divergent).toBe(1);
      expect(firstRun.fixed).toBe(1);

      const persisted = await Regiao.findById(regiao._id).lean();
      expect(persisted?.status).toBe('INACTIVE');
      expect(persisted?.ativo).toBe(false);

      const secondRun = await reconcileRegiaoFieldSync({ empresaId, fix: true });
      expect(secondRun.divergent).toBe(0);
      expect(secondRun.fixed).toBe(0);
    });

    it('--fix deriva campos EN ausentes a partir do PT em documentos legados', async () => {
      const regiao = await createRegiao({
        name: '',
        code: '',
        description: '',
        status: '',
        nome: 'Zona Antiga',
        codigo: 'ZONA-ANTIGA',
        descricao: 'Regiao antiga',
        ativo: true,
      });

      const report = await reconcileRegiaoFieldSync({ empresaId, fix: true });
      expect(report.divergent).toBe(1);
      expect(report.fixed).toBe(1);

      const persisted = await Regiao.findById(regiao._id).lean();
      expect(persisted?.name).toBe('Zona Antiga');
      expect(persisted?.code).toBe('ZONA-ANTIGA');
      expect(persisted?.description).toBe('Regiao antiga');
      expect(persisted?.status).toBe('ACTIVE');

      const secondRun = await reconcileRegiaoFieldSync({ empresaId, fix: true });
      expect(secondRun.divergent).toBe(0);
      expect(secondRun.fixed).toBe(0);
    });

    it('e tenant-safe: nao reconcilia regioes de outra empresa', async () => {
      await createRegiao({ status: 'INACTIVE' });

      const outraEmpresaId = new Types.ObjectId().toString();
      const report = await reconcileRegiaoFieldSync({ empresaId: outraEmpresaId, fix: true });

      expect(report.totalAnalyzed).toBe(0);
      expect(report.divergent).toBe(0);
      expect(report.fixed).toBe(0);
    });
  });
});
