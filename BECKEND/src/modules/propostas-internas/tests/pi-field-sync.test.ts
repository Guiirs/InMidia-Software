/**
 * Guardrail: PIService.update() deve manter Aluguel.startDate/endDate/biWeekIds
 * sincronizados com data_inicio/data_fim/bi_week_ids (campos legados) ao
 * atualizar o periodo de uma PI via Aluguel.updateMany (Sprint 0 - integridade
 * de dados).
 *
 * PeriodService.processPeriodInput e mockado para retornar um periodo
 * normalizado fixo (periodType 'bi-week', que e o unico valor aceito por
 * PropostaInterna.tipoPeriodo apos normalizacao em pi.service.ts), evitando
 * a necessidade de seedar BiWeeks reais — o foco do teste e a sincronizacao
 * de campos do Aluguel, nao o calculo de periodo.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('@shared/container/period.service', () => {
  const actual = jest.requireActual('@shared/container/period.service');
  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      processPeriodInput: jest.fn(),
    },
  };
});

import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import Aluguel from '@modules/alugueis/Aluguel';
import Placa from '@modules/placas/Placa';
import Cliente from '@modules/clientes/Cliente';
import PIService from '@modules/propostas-internas/pi.service';
import PeriodService from '@shared/container/period.service';

const future = (days: number) => new Date(Date.now() + days * 86_400_000);

describe('PIService.update — sincronizacao de campos do Aluguel', () => {
  let mongo: MongoMemoryServer;
  let empresaId: string;
  let clienteId: string;
  let service: PIService;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    service = new PIService();
  });

  beforeEach(async () => {
    empresaId = new Types.ObjectId().toString();
    clienteId = new Types.ObjectId().toString();
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('atualizar periodo da PI sincroniza startDate/endDate/biWeekIds <-> data_inicio/data_fim/bi_week_ids nos alugueis vinculados', async () => {
    const cliente = await Cliente.create({ nome: 'Cliente PI Field Sync', empresaId });
    const placa = await Placa.create({
      numero_placa: `PIFS-${new Types.ObjectId().toString().slice(-6)}`,
      empresaId,
      regiaoId: new Types.ObjectId(),
      disponivel: true,
    });

    const oldStart = future(1);
    const oldEnd = future(10);
    const newStart = future(2);
    const newEnd = future(20);

    (PeriodService.processPeriodInput as jest.Mock).mockResolvedValue({
      periodType: 'bi-week',
      startDate: newStart,
      endDate: newEnd,
      biWeekIds: ['2026-B99'],
      biWeeks: [],
    });

    const pi = await PropostaInterna.create({
      empresaId,
      clienteId,
      pi_code: `PI-${new Types.ObjectId().toString().slice(-6)}`,
      periodType: 'custom',
      startDate: oldStart,
      endDate: oldEnd,
      dataInicio: oldStart,
      dataFim: oldEnd,
      valorTotal: 1000,
      descricao: 'PI field sync',
      status: 'DRAFT',
      placas: [],
    });

    await Aluguel.create({
      placaId: placa._id,
      clienteId: cliente._id,
      empresaId,
      pi_code: pi.pi_code,
      periodType: 'custom',
      startDate: oldStart,
      endDate: oldEnd,
      data_inicio: oldStart,
      data_fim: oldEnd,
      status: 'ativo',
    });

    await service.update(String(pi._id), {
      startDate: newStart,
      endDate: newEnd,
    }, empresaId);

    const aluguel = await Aluguel.findOne({ pi_code: pi.pi_code, empresaId }).lean();
    expect(aluguel?.startDate).toEqual(newStart);
    expect(aluguel?.endDate).toEqual(newEnd);
    expect(aluguel?.data_inicio).toEqual(newStart);
    expect(aluguel?.data_fim).toEqual(newEnd);
    expect(aluguel?.biWeekIds).toEqual(['2026-B99']);
    expect(aluguel?.bi_week_ids).toEqual(['2026-B99']);
  });
});
