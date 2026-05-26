import type {
  InventoryAvailability,
  InventoryCommercialStatus,
  InventorySource,
} from '../contracts/inventory.contracts';

function toDate(input: Date | string | null | undefined): Date | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function overlapsNow(start: Date | null, end: Date | null, now: Date): boolean {
  if (!start || !end) return false;
  return start <= now && end >= now;
}

function startsInFuture(start: Date | null, now: Date): boolean {
  return !!start && start > now;
}

export function calculateAvailability(
  source: InventorySource,
  now: Date,
): InventoryAvailability {
  const physicalAvailable = source.placa.disponivel ?? source.placa.ativa;
  const legacyStatus = source.placa.statusAluguel;

  if (physicalAvailable === false) {
    return {
      status: 'unavailable',
      available: false,
      reason: 'PLACA_MARKED_UNAVAILABLE',
    };
  }

  if (legacyStatus === 'alugada') {
    return { status: 'occupied', available: false, reason: 'LEGACY_STATUS_OCCUPIED' };
  }

  if (legacyStatus === 'reservada') {
    return { status: 'reserved', available: false, reason: 'LEGACY_STATUS_RESERVED' };
  }

  const alugueis = source.alugueis ?? [];
  const hasActiveRental = alugueis.some((aluguel) => {
    if (aluguel.status === 'cancelado' || aluguel.status === 'finalizado') return false;
    return overlapsNow(toDate(aluguel.startDate), toDate(aluguel.endDate), now);
  });

  if (hasActiveRental || source.placa.aluguel_ativo === true) {
    return { status: 'occupied', available: false, reason: 'ACTIVE_RENTAL' };
  }

  const hasFutureRental = alugueis.some((aluguel) => {
    if (aluguel.status === 'cancelado' || aluguel.status === 'finalizado') return false;
    return startsInFuture(toDate(aluguel.startDate), now);
  });

  if (hasFutureRental || source.placa.aluguel_futuro === true) {
    return { status: 'reserved', available: false, reason: 'FUTURE_RENTAL' };
  }

  if (physicalAvailable === true) {
    return { status: 'available', available: true, reason: 'NO_ACTIVE_OPERATIONAL_LINK' };
  }

  const status: InventoryCommercialStatus = 'unknown';
  return { status, available: null, reason: 'INSUFFICIENT_AVAILABILITY_DATA' };
}
