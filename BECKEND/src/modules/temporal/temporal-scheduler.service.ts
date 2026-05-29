import Contrato from '@modules/contratos/Contrato';
import Empresa from '@modules/empresas/Empresa';
import Placa from '@modules/placas/Placa';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import TemporalReservation, { type ITemporalReservation } from './TemporalReservation';
import { temporalEngine } from './temporal.service';
import { createTemporalAlert } from './temporal-alerts.bridge';

type SchedulerResult = {
  expiredCount?: number;
  contractsEndingSoon?: number;
  expiredPendingRelease?: number;
  orphanReservations?: number;
  integrityIssues?: number;
};

export class TemporalSchedulerService {
  async expirePastReservations(empresaId: string, now: Date = new Date()): Promise<{ expiredCount: number }> {
    if (!empresaId) throw new Error('[TemporalScheduler] empresaId é obrigatório para expirePastReservations');

    const reservations = await TemporalReservation.find({
      empresaId,
      sourceType: { $ne: 'MANUAL_BLOCK' },
      status: { $in: ['RESERVED', 'ACTIVE'] },
      endDate: { $lt: now },
    }).lean<ITemporalReservation[]>();

    if (reservations.length === 0) return { expiredCount: 0 };

    const result = await TemporalReservation.updateMany(
      { _id: { $in: reservations.map((reservation) => reservation._id) }, empresaId },
      { $set: { status: 'EXPIRED' } },
    );

    await Promise.all(reservations.map((reservation) => temporalEngine.recordEvent({
      empresaId: String(reservation.empresaId),
      plateId: String(reservation.plateId),
      sourceType: reservation.sourceType,
      sourceId: reservation.sourceId,
      eventType: 'TEMPORAL_RESERVATION_EXPIRED',
      message: 'Reserva temporal vencida marcada como EXPIRED.',
      metadata: { reservationId: String(reservation._id), endDate: reservation.endDate },
    })));

    return { expiredCount: result.modifiedCount ?? 0 };
  }

  async detectContractsEndingSoon(empresaId: string, days = 30, now: Date = new Date()) {
    if (!empresaId) throw new Error('[TemporalScheduler] empresaId é obrigatório para detectContractsEndingSoon');

    const until = new Date(now);
    until.setDate(until.getDate() + days);

    const reservations = await TemporalReservation.find({
      empresaId,
      sourceType: 'CONTRACT',
      status: 'ACTIVE',
      endDate: { $gte: now, $lte: until },
    }).lean<ITemporalReservation[]>();

    await Promise.all(reservations.map(async (reservation) => {
      const dedupeKey = `contract-ending:${reservation.sourceId}:${reservation.plateId}:${reservation.endDate.toISOString()}`;
      await temporalEngine.recordEvent({
        empresaId: String(reservation.empresaId),
        plateId: String(reservation.plateId),
        sourceType: 'CONTRACT',
        sourceId: reservation.sourceId,
        eventType: 'TEMPORAL_CONTRACT_ENDING_SOON',
        message: `Contrato ${reservation.sourceId} vence em ate ${days} dias.`,
        metadata: { reservationId: String(reservation._id), days, dedupeKey },
      });
      await createTemporalAlert({
        empresaId: String(reservation.empresaId),
        type: 'temporal.contract_ending_soon',
        severity: 'warning',
        message: `Contrato vence em ate ${days} dias.`,
        payload: { dedupeKey, reservationId: String(reservation._id), sourceId: reservation.sourceId },
      });
    }));

    return { contractsEndingSoon: reservations.length, reservations };
  }

  async detectExpiredPendingRelease(empresaId: string, now: Date = new Date()) {
    if (!empresaId) throw new Error('[TemporalScheduler] empresaId é obrigatório para detectExpiredPendingRelease');

    const reservations = await TemporalReservation.find({
      empresaId,
      sourceType: { $ne: 'MANUAL_BLOCK' },
      status: 'EXPIRED',
      endDate: { $lt: now },
    }).lean<ITemporalReservation[]>();

    const plateIds = [...new Set(reservations.map((reservation) => String(reservation.plateId)))];
    const blockedPlates = await Placa.find({ _id: { $in: plateIds }, disponivel: false, empresaId }).lean<any[]>();
    const blockedSet = new Set(blockedPlates.map((plate) => String(plate._id)));
    const pending = reservations.filter((reservation) => blockedSet.has(String(reservation.plateId)));

    await Promise.all(pending.map(async (reservation) => {
      const dedupeKey = `expired-pending-release:${reservation._id}`;
      await temporalEngine.recordEvent({
        empresaId: String(reservation.empresaId),
        plateId: String(reservation.plateId),
        sourceType: reservation.sourceType,
        sourceId: reservation.sourceId,
        eventType: 'TEMPORAL_EXPIRED_PENDING_RELEASE',
        message: 'Reserva vencida com placa ainda bloqueada.',
        metadata: { reservationId: String(reservation._id), dedupeKey },
      });
      await createTemporalAlert({
        empresaId: String(reservation.empresaId),
        type: 'temporal.expired_pending_release',
        severity: 'critical',
        message: 'Contrato vencido aguardando liberacao da placa.',
        payload: { dedupeKey, reservationId: String(reservation._id), plateId: String(reservation.plateId) },
      });
    }));

    return { expiredPendingRelease: pending.length, reservations: pending };
  }

  async detectOrphanTemporalReservations(empresaId: string) {
    if (!empresaId) throw new Error('[TemporalScheduler] empresaId é obrigatório para detectOrphanTemporalReservations');

    const reservations = await TemporalReservation.find({
      empresaId,
      sourceType: { $in: ['CONTRACT', 'PI'] },
    }).lean<ITemporalReservation[]>();

    const issues = [];
    for (const reservation of reservations) {
      const exists = reservation.sourceType === 'CONTRACT'
        ? await Contrato.exists({ _id: reservation.sourceId, empresaId: reservation.empresaId })
        : await PropostaInterna.exists({ _id: reservation.sourceId, empresaId: reservation.empresaId });

      if (!exists) {
        issues.push(reservation);
        const dedupeKey = `orphan:${reservation.sourceType}:${reservation.sourceId}:${reservation.plateId}`;
        await temporalEngine.recordEvent({
          empresaId: String(reservation.empresaId),
          plateId: String(reservation.plateId),
          sourceType: reservation.sourceType,
          sourceId: reservation.sourceId,
          eventType: 'TEMPORAL_ORPHAN_RESERVATION_DETECTED',
          message: 'Reserva temporal sem entidade original.',
          metadata: { reservationId: String(reservation._id), dedupeKey },
        });
        await createTemporalAlert({
          empresaId: String(reservation.empresaId),
          type: 'temporal.orphan_reservation',
          severity: 'warning',
          message: 'Reserva temporal orfa detectada.',
          payload: { dedupeKey, reservationId: String(reservation._id) },
        });
      }
    }

    return { orphanReservations: issues.length, reservations: issues };
  }

  async detectTemporalIntegrityIssues(empresaId: string, now: Date = new Date()) {
    if (!empresaId) throw new Error('[TemporalScheduler] empresaId é obrigatório para detectTemporalIntegrityIssues');

    const report = await this.getTemporalIntegrityReport(empresaId, now);
    const totalIssues = Object.values(report).reduce((sum, value) => (
      Array.isArray(value) ? sum + value.length : sum
    ), 0);

    if (totalIssues > 0) {
      await temporalEngine.recordEvent({
        empresaId,
        eventType: 'TEMPORAL_INTEGRITY_ISSUE_DETECTED',
        message: 'Inconsistencias temporais detectadas.',
        metadata: { totalIssues },
      });
    }

    return { integrityIssues: totalIssues, report };
  }

  async runDailyTemporalMaintenance(empresaId?: string, days = 30, now: Date = new Date()): Promise<SchedulerResult> {
    if (!empresaId) {
      // Global scheduler: iterate per empresa, never mix tenant data
      const empresas = await Empresa.find({}).select('_id').lean();
      const results: SchedulerResult[] = [];
      for (const emp of empresas) {
        const result = await this.runDailyTemporalMaintenance(String(emp._id), days, now);
        results.push(result);
      }
      return results.reduce((acc, r) => ({
        expiredCount: (acc.expiredCount ?? 0) + (r.expiredCount ?? 0),
        contractsEndingSoon: (acc.contractsEndingSoon ?? 0) + (r.contractsEndingSoon ?? 0),
        expiredPendingRelease: (acc.expiredPendingRelease ?? 0) + (r.expiredPendingRelease ?? 0),
        orphanReservations: (acc.orphanReservations ?? 0) + (r.orphanReservations ?? 0),
        integrityIssues: (acc.integrityIssues ?? 0) + (r.integrityIssues ?? 0),
      }), {} as SchedulerResult);
    }

    const [expired, endingSoon, pendingRelease, orphan, integrity] = await Promise.all([
      this.expirePastReservations(empresaId, now),
      this.detectContractsEndingSoon(empresaId, days, now),
      this.detectExpiredPendingRelease(empresaId, now),
      this.detectOrphanTemporalReservations(empresaId),
      this.detectTemporalIntegrityIssues(empresaId, now),
    ]);

    return {
      expiredCount: expired.expiredCount,
      contractsEndingSoon: endingSoon.contractsEndingSoon,
      expiredPendingRelease: pendingRelease.expiredPendingRelease,
      orphanReservations: orphan.orphanReservations,
      integrityIssues: integrity.integrityIssues,
    };
  }

  async getTemporalIntegrityReport(empresaId: string, now: Date = new Date()) {
    if (!empresaId) throw new Error('[TemporalScheduler] empresaId é obrigatório para getTemporalIntegrityReport');

    const [contracts, reservations, plates] = await Promise.all([
      Contrato.find({ empresaId, status: { $ne: 'cancelado' } }).populate('piId').lean<any[]>(),
      TemporalReservation.find({ empresaId }).lean<ITemporalReservation[]>(),
      Placa.find({ empresaId, disponivel: false }).lean<any[]>(),
    ]);

    const contractWithoutLedger = [];
    for (const contract of contracts) {
      const ledger = await TemporalReservation.exists({ empresaId, sourceType: 'CONTRACT', sourceId: String(contract._id) });
      if (!ledger) contractWithoutLedger.push({ id: String(contract._id), empresaId: String(contract.empresaId) });
    }

    const ledgerWithoutOriginal = [];
    for (const reservation of reservations) {
      if (reservation.sourceType === 'CONTRACT') {
        const exists = await Contrato.exists({ _id: reservation.sourceId, empresaId: reservation.empresaId });
        if (!exists) ledgerWithoutOriginal.push({ id: String(reservation._id), sourceId: reservation.sourceId, empresaId: String(reservation.empresaId) });
      }
      if (reservation.sourceType === 'PI') {
        const exists = await PropostaInterna.exists({ _id: reservation.sourceId, empresaId: reservation.empresaId });
        if (!exists) ledgerWithoutOriginal.push({ id: String(reservation._id), sourceId: reservation.sourceId, empresaId: String(reservation.empresaId) });
      }
    }

    const activeReservations = reservations.filter((reservation) => (
      ['RESERVED', 'ACTIVE', 'BLOCKED'].includes(reservation.status)
      && reservation.startDate <= now
      && reservation.endDate >= now
    ));
    const activeByPlate = new Set(activeReservations.map((reservation) => String(reservation.plateId)));
    const blockedPlateWithoutActiveReservation = plates
      .filter((plate) => !activeByPlate.has(String(plate._id)))
      .map((plate) => ({ id: String(plate._id), empresaId: String(plate.empresaId) }));

    const activeExpiredReservations = reservations
      .filter((reservation) => ['RESERVED', 'ACTIVE'].includes(reservation.status) && reservation.endDate < now)
      .map((reservation) => ({ id: String(reservation._id), empresaId: String(reservation.empresaId) }));

    const invalidDateReservations = reservations
      .filter((reservation) => !reservation.startDate || !reservation.endDate || reservation.startDate >= reservation.endDate)
      .map((reservation) => ({ id: String(reservation._id), empresaId: String(reservation.empresaId) }));

    const overlappingReservations = [];
    for (let i = 0; i < reservations.length; i += 1) {
      for (let j = i + 1; j < reservations.length; j += 1) {
        const a = reservations[i];
        const b = reservations[j];
        if (!a || !b) continue;
        if (String(a.plateId) !== String(b.plateId)) continue;
        if (!['RESERVED', 'ACTIVE', 'BLOCKED'].includes(a.status) || !['RESERVED', 'ACTIVE', 'BLOCKED'].includes(b.status)) continue;
        if (a.startDate < b.endDate && a.endDate > b.startDate) {
          overlappingReservations.push({
            plateId: String(a.plateId),
            reservationIds: [String(a._id), String(b._id)],
            empresaId: String(a.empresaId),
          });
        }
      }
    }

    const piReservedWithContractNotPromoted = [];
    const piReservations = reservations.filter((reservation) => reservation.sourceType === 'PI' && reservation.status === 'RESERVED');
    for (const reservation of piReservations) {
      const contract = await Contrato.findOne({ piId: reservation.sourceId, empresaId: reservation.empresaId }).lean();
      const promoted = contract
        ? await TemporalReservation.exists({ sourceType: 'CONTRACT', sourceId: String(contract._id), plateId: reservation.plateId })
        : null;
      if (contract && !promoted) {
        piReservedWithContractNotPromoted.push({
          piId: reservation.sourceId,
          contractId: String(contract._id),
          plateId: String(reservation.plateId),
          empresaId: String(reservation.empresaId),
        });
      }
    }

    return {
      contractWithoutLedger,
      ledgerWithoutOriginal,
      blockedPlateWithoutActiveReservation,
      activeExpiredReservations,
      invalidDateReservations,
      overlappingReservations,
      piReservedWithContractNotPromoted,
    };
  }
}

export const temporalSchedulerService = new TemporalSchedulerService();
