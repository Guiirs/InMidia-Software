import { Types } from 'mongoose';
import Aluguel from '@modules/alugueis/Aluguel';
import AppError from '@shared/container/AppError';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type OperationalStatus = 'active' | 'expiring' | 'expired' | 'future' | 'cancelled' | 'completed';

interface ListContractsParams {
  boardId?: string;
  status?: string;
  limit?: number;
}

interface CreateContractInput {
  boardId?: string;
  placaId?: string;
  clientId?: string;
  clienteId?: string;
  startDate?: string;
  endDate?: string;
  dataInicio?: string;
  dataFim?: string;
  periodType?: string;
  biWeekIds?: string[];
  piId?: string;
  piCode?: string;
  description?: string;
  observacoes?: string;
}

interface UpdateContractInput {
  boardId?: string;
  placaId?: string;
  clientId?: string;
  clienteId?: string;
  startDate?: string;
  endDate?: string;
  dataInicio?: string;
  dataFim?: string;
  periodType?: string;
  biWeekIds?: string[];
  status?: string;
  description?: string;
  observacoes?: string;
}

interface RenewContractInput {
  newEndDate?: string;
  endDate?: string;
  dataFim?: string;
  observacoes?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function requireObjectId(value: unknown, field: string): string {
  const stringValue = typeof value === 'string' ? value : '';
  if (!Types.ObjectId.isValid(stringValue)) {
    throw new AppError(`${field} invalido.`, 400, [{ field, message: `${field} deve ser um ObjectId valido.` }]);
  }
  return stringValue;
}

function requireDate(value: unknown, field: string): Date {
  const date = asDate(value);
  if (!date) {
    throw new AppError(`${field} invalida.`, 400, [{ field, message: `${field} deve ser uma data valida.` }]);
  }
  return date;
}

function normalizeDbStatus(status?: string): 'ativo' | 'finalizado' | 'cancelado' | undefined {
  if (!status) return undefined;
  const normalized = String(status).toLowerCase();
  const map: Record<string, 'ativo' | 'finalizado' | 'cancelado'> = {
    active: 'ativo',
    ativo: 'ativo',
    expiring: 'ativo',
    renewed: 'ativo',
    completed: 'finalizado',
    complete: 'finalizado',
    concluded: 'finalizado',
    finalizado: 'finalizado',
    concluido: 'finalizado',
    cancelled: 'cancelado',
    canceled: 'cancelado',
    cancelado: 'cancelado',
    paused: 'cancelado',
  };
  const mapped = map[normalized];
  if (!mapped) {
    throw new AppError('Status de contrato invalido.', 400, [{
      field: 'status',
      message: 'Status permitido: active, completed ou cancelled.',
    }]);
  }
  return mapped;
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

function monthsBetween(start: Date | null, end: Date | null): number {
  if (!start || !end || end <= start) return 1;
  return Math.max(1, Math.ceil(daysBetween(start, end) / 30));
}

function deriveStatus(rawStatus: string, startDate: Date | null, endDate: Date | null, now: Date): OperationalStatus {
  if (rawStatus === 'cancelado') return 'cancelled';
  if (rawStatus === 'finalizado') return endDate && endDate < now ? 'completed' : 'completed';
  if (startDate && startDate > now) return 'future';
  if (endDate && endDate < now) return 'expired';
  if (endDate && daysBetween(now, endDate) <= 30) return 'expiring';
  return 'active';
}

function deriveRisk(status: OperationalStatus, daysToExpire: number | null): RiskLevel {
  if (status === 'expired') return 'critical';
  if (status === 'cancelled' || status === 'completed') return 'low';
  if (status === 'expiring') {
    if ((daysToExpire ?? 999) <= 7) return 'critical';
    if ((daysToExpire ?? 999) <= 15) return 'high';
    return 'medium';
  }
  return 'low';
}

function renewalProbability(risk: RiskLevel, status: OperationalStatus): number {
  if (status === 'cancelled' || status === 'expired') return 0;
  if (status === 'future') return 0.7;
  return { low: 0.86, medium: 0.72, high: 0.6, critical: 0.45 }[risk];
}

function monthlyValueFrom(raw: any, startDate: Date | null, endDate: Date | null): number {
  const pi = raw.proposta_interna && typeof raw.proposta_interna === 'object'
    ? raw.proposta_interna
    : null;
  const total = Number(pi?.valorTotal ?? raw.valorTotal ?? raw.valor ?? 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.round(total / monthsBetween(startDate, endDate));
}

function regionFrom(raw: any): { id: string | null; name: string } {
  const regiao = raw.placaId?.regiaoId;
  if (regiao && typeof regiao === 'object') {
    return {
      id: regiao._id?.toString?.() ?? null,
      name: regiao.nome ?? regiao.codigo ?? 'Sem regiao',
    };
  }
  return { id: null, name: 'Sem regiao' };
}

function toOperationalContract(raw: any, now = new Date()) {
  const startDate = asDate(raw.startDate ?? raw.data_inicio);
  const endDate = asDate(raw.endDate ?? raw.data_fim);
  const status = deriveStatus(raw.status, startDate, endDate, now);
  const daysToExpire = endDate ? daysBetween(now, endDate) : null;
  const riskLevel = deriveRisk(status, daysToExpire);
  const monthlyValue = monthlyValueFrom(raw, startDate, endDate);
  const region = regionFrom(raw);
  const placa = raw.placaId && typeof raw.placaId === 'object' ? raw.placaId : {};
  const cliente = raw.clienteId && typeof raw.clienteId === 'object' ? raw.clienteId : {};
  const pi = raw.proposta_interna && typeof raw.proposta_interna === 'object' ? raw.proposta_interna : {};

  return {
    id: raw._id?.toString?.() ?? String(raw.id ?? ''),
    code: raw.pi_code || pi.pi_code || `ALG-${String(raw._id ?? '').slice(-6).toUpperCase()}`,
    clientName: cliente.nome ?? 'Cliente nao informado',
    campaignName: pi.descricao ?? pi.produto ?? raw.observacoes ?? 'Contrato operacional',
    boardId: placa._id?.toString?.() ?? raw.placaId?.toString?.() ?? null,
    boardCode: placa.numero_placa ?? 'N/A',
    boardLocation: placa.nomeDaRua ?? null,
    region,
    startDate: startDate?.toISOString() ?? null,
    endDate: endDate?.toISOString() ?? null,
    monthlyValue,
    totalValue: monthlyValue * monthsBetween(startDate, endDate),
    status,
    riskLevel,
    renewalProbability: renewalProbability(riskLevel, status),
    daysToExpire,
    owner: null,
    source: 'aluguel',
    rawStatus: raw.status,
    createdAt: asDate(raw.createdAt)?.toISOString() ?? null,
  };
}

export class OperationalContractService {
  private queryBase(empresaId: string, params: ListContractsParams = {}) {
    const filter: Record<string, any> = { empresaId };
    if (params.boardId) filter.placaId = params.boardId;
    if (params.status) filter.status = params.status;
    return filter;
  }

  async listContracts(empresaId: string, params: ListContractsParams = {}) {
    const limit = Math.min(Math.max(Number(params.limit ?? 200), 1), 500);
    const rows = await Aluguel.find(this.queryBase(empresaId, params))
      .populate({
        path: 'placaId',
        select: 'numero_placa nomeDaRua regiaoId',
        populate: { path: 'regiaoId', select: 'nome codigo' },
      })
      .populate('clienteId', 'nome')
      .populate('proposta_interna', 'pi_code descricao produto valorTotal startDate endDate')
      .sort({ endDate: 1, data_fim: 1, createdAt: -1 })
      .limit(limit)
      .lean();

    return rows.map((row) => toOperationalContract(row));
  }

  async listActiveContracts(empresaId: string, limit = 200) {
    const contracts = await this.listContracts(empresaId, { limit });
    return contracts.filter((contract) => contract.status === 'active' || contract.status === 'expiring');
  }

  async listExpiringContracts(empresaId: string, days = 30, limit = 200) {
    const contracts = await this.listContracts(empresaId, { limit });
    return contracts.filter((contract) =>
      contract.daysToExpire != null
      && contract.daysToExpire >= 0
      && contract.daysToExpire <= days
      && contract.status !== 'cancelled'
      && contract.status !== 'completed'
    );
  }

  async listTimeline(empresaId: string, limit = 100) {
    const contracts = await this.listContracts(empresaId, { limit: Math.min(Math.max(Number(limit), 1), 500) });

    return contracts
      .map((contract) => {
        const occurredAt = contract.createdAt ?? contract.startDate ?? contract.endDate ?? new Date().toISOString();
        const actionByStatus: Record<OperationalStatus, string> = {
          active: 'Contrato ativo',
          expiring: 'Contrato proximo do vencimento',
          expired: 'Contrato vencido',
          future: 'Contrato agendado',
          cancelled: 'Contrato cancelado',
          completed: 'Contrato concluido',
        };

        return {
          id: `contract-${contract.id}`,
          type: 'contract',
          contractId: contract.id,
          contractCode: contract.code,
          clientName: contract.clientName,
          campaignName: contract.campaignName,
          label: `${contract.code} - ${contract.clientName} - ${actionByStatus[contract.status]}`,
          status: contract.status,
          riskLevel: contract.riskLevel,
          category: contract.riskLevel === 'high' || contract.riskLevel === 'critical' ? 'warning' : 'success',
          icon: contract.status === 'cancelled' || contract.status === 'expired' ? 'cancel' : 'description',
          occurredAt,
          timeLabel: contract.daysToExpire == null ? 'sem vencimento' : `vence em ${contract.daysToExpire} dias`,
          contract,
        };
      })
      .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
      .slice(0, Math.min(Math.max(Number(limit), 1), 500));
  }

  async createContract(empresaId: string, input: CreateContractInput) {
    const placaId = requireObjectId(input.boardId ?? input.placaId, 'boardId');
    const clienteId = requireObjectId(input.clientId ?? input.clienteId, 'clientId');
    const startDate = requireDate(input.startDate ?? input.dataInicio, 'startDate');
    const endDate = requireDate(input.endDate ?? input.dataFim, 'endDate');

    if (endDate <= startDate) {
      throw new AppError('Data final deve ser posterior a data inicial.', 400, [{
        field: 'endDate',
        message: 'endDate deve ser posterior a startDate.',
      }]);
    }

    const conflict = await Aluguel.findOne({
      empresaId,
      placaId,
      status: { $ne: 'cancelado' },
      startDate: { $lt: endDate },
      endDate: { $gt: startDate },
    }).lean();

    if (conflict) {
      throw new AppError('Esta placa ja possui contrato ativo no periodo solicitado.', 409);
    }

    const contract = await Aluguel.create({
      empresaId,
      placaId,
      clienteId,
      periodType: input.periodType ?? 'custom',
      startDate,
      endDate,
      data_inicio: startDate,
      data_fim: endDate,
      biWeekIds: input.biWeekIds ?? [],
      bi_week_ids: input.biWeekIds ?? [],
      proposta_interna: input.piId && Types.ObjectId.isValid(input.piId) ? input.piId : undefined,
      pi_code: input.piCode,
      tipo: input.piId ? 'pi' : 'manual',
      observacoes: input.observacoes ?? input.description,
      status: 'ativo',
    });

    return this.getContractById(empresaId, String(contract._id));
  }

  async getContractById(empresaId: string, id: string) {
    const contract = await Aluguel.findOne({ _id: requireObjectId(id, 'id'), empresaId })
      .populate({
        path: 'placaId',
        select: 'numero_placa nomeDaRua regiaoId',
        populate: { path: 'regiaoId', select: 'nome codigo' },
      })
      .populate('clienteId', 'nome')
      .populate('proposta_interna', 'pi_code descricao produto valorTotal startDate endDate')
      .lean();

    if (!contract) {
      throw new AppError('Contrato nao encontrado.', 404);
    }

    return toOperationalContract(contract);
  }

  async updateContract(empresaId: string, id: string, input: UpdateContractInput) {
    const update: Record<string, unknown> = {};

    if (input.boardId || input.placaId) update.placaId = requireObjectId(input.boardId ?? input.placaId, 'boardId');
    if (input.clientId || input.clienteId) update.clienteId = requireObjectId(input.clientId ?? input.clienteId, 'clientId');
    if (input.periodType) update.periodType = input.periodType;
    if (input.biWeekIds) {
      update.biWeekIds = input.biWeekIds;
      update.bi_week_ids = input.biWeekIds;
    }
    if (input.startDate || input.dataInicio) {
      const startDate = requireDate(input.startDate ?? input.dataInicio, 'startDate');
      update.startDate = startDate;
      update.data_inicio = startDate;
    }
    if (input.endDate || input.dataFim) {
      const endDate = requireDate(input.endDate ?? input.dataFim, 'endDate');
      update.endDate = endDate;
      update.data_fim = endDate;
    }
    const status = normalizeDbStatus(input.status);
    if (status) update.status = status;
    if (input.observacoes !== undefined || input.description !== undefined) {
      update.observacoes = input.observacoes ?? input.description;
    }

    if (Object.keys(update).length === 0) {
      return this.getContractById(empresaId, id);
    }

    const updated = await Aluguel.findOneAndUpdate(
      { _id: requireObjectId(id, 'id'), empresaId },
      { $set: update },
      { new: true, runValidators: true },
    ).lean();

    if (!updated) {
      throw new AppError('Contrato nao encontrado.', 404);
    }

    return this.getContractById(empresaId, id);
  }

  async changeStatus(empresaId: string, id: string, status: string) {
    return this.updateContract(empresaId, id, { status });
  }

  async cancelContract(empresaId: string, id: string, reason?: string) {
    return this.updateContract(empresaId, id, {
      status: 'cancelled',
      observacoes: reason ? `Cancelado: ${reason}` : undefined,
    });
  }

  async renewContract(empresaId: string, id: string, input: RenewContractInput) {
    const endDate = requireDate(input.newEndDate ?? input.endDate ?? input.dataFim, 'newEndDate');
    return this.updateContract(empresaId, id, {
      endDate: endDate.toISOString(),
      status: 'active',
      observacoes: input.observacoes,
    });
  }

  async getSummary(empresaId: string) {
    const contracts = await this.listContracts(empresaId, { limit: 500 });
    const now = new Date();
    const countStatus = (status: OperationalStatus) => contracts.filter((item) => item.status === status).length;
    const expiringWithin = (days: number) => contracts.filter((item) =>
      item.status !== 'cancelled'
      && item.status !== 'completed'
      && item.daysToExpire != null
      && item.daysToExpire >= 0
      && item.daysToExpire <= days
    );
    const activeLike = contracts.filter((item) => item.status === 'active' || item.status === 'expiring');
    const expiring30 = expiringWithin(30);

    const byRegionMap = new Map<string, any>();
    contracts.forEach((item) => {
      const key = item.region.id ?? item.region.name;
      const current = byRegionMap.get(key) ?? {
        id: item.region.id,
        name: item.region.name,
        totalContracts: 0,
        activeContracts: 0,
        revenue: 0,
        revenueAtRisk: 0,
      };
      current.totalContracts += 1;
      if (item.status === 'active' || item.status === 'expiring') {
        current.activeContracts += 1;
        current.revenue += item.monthlyValue;
      }
      if (item.riskLevel === 'high' || item.riskLevel === 'critical') {
        current.revenueAtRisk += item.monthlyValue;
      }
      byRegionMap.set(key, current);
    });

    const byStatus = ['active', 'expiring', 'expired', 'future', 'cancelled', 'completed']
      .map((status) => ({
        status,
        count: countStatus(status as OperationalStatus),
        percentage: contracts.length ? countStatus(status as OperationalStatus) / contracts.length : 0,
      }));

    const risk = contracts.reduce((acc, item) => {
      acc[item.riskLevel] += 1;
      return acc;
    }, { low: 0, medium: 0, high: 0, critical: 0 });

    return {
      generatedAt: now.toISOString(),
      totals: {
        activeContracts: activeLike.length,
        expiring7Days: expiringWithin(7).length,
        expiring15Days: expiringWithin(15).length,
        expiring30Days: expiring30.length,
        expiredContracts: countStatus('expired'),
        futureContracts: countStatus('future'),
      },
      revenue: {
        activeMonthlyRevenue: activeLike.reduce((sum, item) => sum + item.monthlyValue, 0),
        revenueAtRisk: expiring30.reduce((sum, item) => sum + item.monthlyValue, 0),
        projectedRenewalRevenue: expiring30.reduce((sum, item) => sum + Math.round(item.monthlyValue * item.renewalProbability), 0),
      },
      risk,
      expiringContracts: expiring30
        .sort((a, b) => (a.daysToExpire ?? 999) - (b.daysToExpire ?? 999))
        .slice(0, 12),
      recentContracts: [...contracts]
        .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
        .slice(0, 12),
      byRegion: Array.from(byRegionMap.values()),
      byStatus,
    };
  }
}
