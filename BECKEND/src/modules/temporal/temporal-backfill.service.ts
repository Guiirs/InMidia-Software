import { Types } from 'mongoose';
import Aluguel from '@modules/alugueis/Aluguel';
import Contrato from '@modules/contratos/Contrato';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import TemporalReservation from './TemporalReservation';
import { temporalEngine } from './temporal.service';
import type { TemporalReservationStatus, TemporalSourceType } from './temporal.types';

type BackfillIssue = {
  sourceType: TemporalSourceType;
  sourceId: string;
  plateId?: string;
  reason: string;
};

export type TemporalBackfillReport = {
  totalAnalyzed: number;
  reservationsCreated: number;
  reservationsSkippedExisting: number;
  conflictsFound: number;
  recordsWithoutPlate: number;
  recordsWithoutPeriod: number;
  invalidRecords: number;
  errors: BackfillIssue[];
  conflicts: BackfillIssue[];
};

type Candidate = {
  empresaId: string;
  plateId?: string;
  sourceType: TemporalSourceType;
  sourceId: string;
  customerId?: string;
  startDate?: Date;
  endDate?: Date;
  status: TemporalReservationStatus;
  reason: string;
};

const emptyReport = (): TemporalBackfillReport => ({
  totalAnalyzed: 0,
  reservationsCreated: 0,
  reservationsSkippedExisting: 0,
  conflictsFound: 0,
  recordsWithoutPlate: 0,
  recordsWithoutPeriod: 0,
  invalidRecords: 0,
  errors: [],
  conflicts: [],
});

function asString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function resolvePeriod(source: any): { startDate?: Date; endDate?: Date } {
  return {
    startDate: toDate(source.startDate || source.dataInicio || source.data_inicio),
    endDate: toDate(source.endDate || source.dataFim || source.data_fim),
  };
}

function mapStatus(status: string | undefined, startDate: Date, endDate: Date, now: Date): TemporalReservationStatus {
  const normalized = String(status || '').toLowerCase();
  if (['cancelado', 'cancelada', 'cancelled', 'rejeitada'].includes(normalized)) return 'CANCELLED';
  if (['concluido', 'concluida', 'finalizado', 'finalizada'].includes(normalized)) return 'EXPIRED';
  if (['vencida', 'vencido'].includes(normalized)) return 'EXPIRED';
  if (endDate < now) return 'EXPIRED';
  if (startDate > now) return 'RESERVED';
  return 'ACTIVE';
}

function isBlockingBackfill(status: TemporalReservationStatus): boolean {
  return status === 'ACTIVE' || status === 'RESERVED' || status === 'BLOCKED';
}

export class TemporalBackfillService {
  async runBackfill(input: { empresaId?: string; createdBy?: string; now?: Date } = {}): Promise<TemporalBackfillReport> {
    const now = input.now ?? new Date();
    const report = emptyReport();

    if (input.empresaId) {
      await temporalEngine.recordEvent({
        empresaId: input.empresaId,
        eventType: 'TEMPORAL_BACKFILL_STARTED',
        message: 'Backfill temporal iniciado.',
        metadata: { now: now.toISOString() },
        createdBy: input.createdBy,
      });
    }

    const candidates = await this.buildCandidates(input.empresaId, now);
    for (const candidate of candidates) {
      report.totalAnalyzed += 1;
      await this.processCandidate(candidate, report, input.createdBy);
    }

    if (input.empresaId) {
      await temporalEngine.recordEvent({
        empresaId: input.empresaId,
        eventType: 'TEMPORAL_BACKFILL_COMPLETED',
        message: 'Backfill temporal concluido.',
        metadata: report,
        createdBy: input.createdBy,
      });
    }

    return report;
  }

  private async buildCandidates(empresaId: string | undefined, now: Date): Promise<Candidate[]> {
    const empresaFilter = empresaId ? { empresaId } : {};
    const [contracts, pisWithContracts, pis, rentals] = await Promise.all([
      Contrato.find(empresaFilter).populate('piId').lean<any[]>(),
      Contrato.find(empresaFilter).select('piId').lean<any[]>(),
      PropostaInterna.find(empresaFilter).lean<any[]>(),
      Aluguel.find(empresaFilter).lean<any[]>(),
    ]);

    const contractPiIds = new Set(pisWithContracts.map((contract) => asString(contract.piId)).filter(Boolean));
    const candidates: Candidate[] = [];

    contracts.forEach((contract) => {
      const pi = contract.piId && typeof contract.piId === 'object' ? contract.piId : null;
      const period = resolvePeriod(pi || {});
      const status = period.startDate && period.endDate
        ? mapStatus(contract.status, period.startDate, period.endDate, now)
        : 'CANCELLED';
      const plates = Array.isArray(pi?.placas) ? pi.placas : [];

      if (plates.length === 0) {
        candidates.push({
          empresaId: String(contract.empresaId),
          sourceType: 'CONTRACT',
          sourceId: String(contract._id),
          customerId: asString(contract.clienteId),
          startDate: period.startDate,
          endDate: period.endDate,
          status,
          reason: 'Contrato legado sem placa vinculada via PI.',
        });
        return;
      }

      plates.forEach((plateId: unknown) => candidates.push({
        empresaId: String(contract.empresaId),
        plateId: asString(plateId),
        sourceType: 'CONTRACT',
        sourceId: String(contract._id),
        customerId: asString(contract.clienteId),
        startDate: period.startDate,
        endDate: period.endDate,
        status,
        reason: `Backfill de contrato ${contract.numero || contract._id}`,
      }));
    });

    pis
      .filter((pi) => !contractPiIds.has(String(pi._id)))
      .forEach((pi) => {
        const period = resolvePeriod(pi);
        const status = period.startDate && period.endDate
          ? mapStatus(pi.status === 'vencida' ? 'vencida' : 'em_andamento', period.startDate, period.endDate, now)
          : 'CANCELLED';
        const plates = Array.isArray(pi.placas) ? pi.placas : [];

        if (plates.length === 0) {
          candidates.push({
            empresaId: String(pi.empresaId),
            sourceType: 'PI',
            sourceId: String(pi._id),
            customerId: asString(pi.clienteId),
            startDate: period.startDate,
            endDate: period.endDate,
            status,
            reason: 'PI legada sem placa vinculada.',
          });
          return;
        }

        plates.forEach((plateId: unknown) => candidates.push({
          empresaId: String(pi.empresaId),
          plateId: asString(plateId),
          sourceType: 'PI',
          sourceId: String(pi._id),
          customerId: asString(pi.clienteId),
          startDate: period.startDate,
          endDate: period.endDate,
          status,
          reason: `Backfill de PI ${pi.pi_code || pi._id}`,
        }));
      });

    rentals.forEach((rental) => {
      const period = resolvePeriod(rental);
      const status = period.startDate && period.endDate
        ? mapStatus(rental.status, period.startDate, period.endDate, now)
        : 'CANCELLED';

      candidates.push({
        empresaId: String(rental.empresaId),
        plateId: asString(rental.placaId || rental.placa),
        sourceType: 'LEGACY_RENTAL',
        sourceId: String(rental._id),
        customerId: asString(rental.clienteId || rental.cliente),
        startDate: period.startDate,
        endDate: period.endDate,
        status,
        reason: `Backfill de aluguel legado ${rental.pi_code || rental._id}`,
      });
    });

    return candidates;
  }

  private async processCandidate(candidate: Candidate, report: TemporalBackfillReport, createdBy?: string): Promise<void> {
    try {
      if (!candidate.plateId) {
        report.recordsWithoutPlate += 1;
        return;
      }

      if (!candidate.startDate || !candidate.endDate) {
        report.recordsWithoutPeriod += 1;
        report.errors.push({ ...candidate, plateId: candidate.plateId, reason: 'Registro sem periodo valido.' });
        return;
      }

      if (candidate.startDate >= candidate.endDate || !Types.ObjectId.isValid(candidate.plateId)) {
        report.invalidRecords += 1;
        report.errors.push({ ...candidate, plateId: candidate.plateId, reason: 'Registro temporal invalido.' });
        return;
      }

      const existing = await TemporalReservation.findOne({
        empresaId: candidate.empresaId,
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        plateId: candidate.plateId,
      }).lean();

      if (existing) {
        report.reservationsSkippedExisting += 1;
        return;
      }

      if (isBlockingBackfill(candidate.status)) {
        const availability = await temporalEngine.checkPlateAvailability(
          candidate.plateId,
          candidate.startDate,
          candidate.endDate,
          { empresaId: candidate.empresaId },
        );

        if (!availability.available) {
          report.conflictsFound += 1;
          report.conflicts.push({ ...candidate, plateId: candidate.plateId, reason: availability.conflicts[0]?.message || 'Conflito temporal.' });
          await temporalEngine.recordEvent({
            empresaId: candidate.empresaId,
            plateId: candidate.plateId,
            sourceType: candidate.sourceType,
            sourceId: candidate.sourceId,
            eventType: 'TEMPORAL_BACKFILL_CONFLICT',
            message: availability.conflicts[0]?.message || 'Conflito temporal durante backfill.',
            metadata: { candidate, conflicts: availability.conflicts },
            createdBy,
          });
          return;
        }
      }

      await TemporalReservation.create({
        empresaId: candidate.empresaId,
        plateId: candidate.plateId,
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        customerId: candidate.customerId,
        startDate: candidate.startDate,
        endDate: candidate.endDate,
        status: candidate.status,
        reason: candidate.reason,
        createdBy,
      });

      report.reservationsCreated += 1;
      await temporalEngine.recordEvent({
        empresaId: candidate.empresaId,
        plateId: candidate.plateId,
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        eventType: 'TEMPORAL_RESERVATION_CREATED',
        message: 'Reserva temporal criada por backfill.',
        metadata: { candidate },
        createdBy,
      });
    } catch (error) {
      report.invalidRecords += 1;
      report.errors.push({
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        plateId: candidate.plateId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const temporalBackfillService = new TemporalBackfillService();
