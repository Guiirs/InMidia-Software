import logger from '@shared/container/logger';
import { spatialService } from '@modules/spatial';
import { calculateAvailability } from '../calculators/availability.calculator';
import { detectInventoryConflicts } from '../calculators/conflict.detector';
import type {
  InventoryConflict,
  InventoryEvaluationContext,
  InventoryEvaluationResult,
  InventoryItem,
  InventoryOccupancy,
  InventorySource,
  InventorySummary,
} from '../contracts/inventory.contracts';

function toDate(input: Date | string | null | undefined): Date | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toId(input: unknown, fallback = 'unknown'): string {
  if (input === undefined || input === null) return fallback;
  return String(input);
}

export class InventoryService {
  evaluateInventoryItem(
    input: InventorySource,
    context: InventoryEvaluationContext = {},
  ): InventoryEvaluationResult {
    const source = this.normalizeInventorySource(input);
    const now = context.now ?? new Date();
    const availability = this.evaluateAvailability(source, now);
    const occupancy = this.evaluateOccupancy(source, now);
    const coordinates = source.placa.coordenadas
      ? spatialService.normalizeGeoPoint(source.placa.coordenadas)
      : { ok: false as const };

    const item: InventoryItem = {
      placaId: toId(source.placa._id ?? source.placa.id),
      empresaId: source.placa.empresaId === undefined ? undefined : String(source.placa.empresaId),
      regiaoId: source.placa.regiaoId === undefined ? undefined : String(source.placa.regiaoId),
      numeroPlaca: source.placa.numero_placa,
      numeroOperacional: source.placa.numeroOperacional ?? undefined,
      coordinates: coordinates.ok ? coordinates.data : undefined,
      status: {
        physical: this.evaluatePhysicalStatus(source),
        commercial: availability.status,
        operational: 'unknown',
      },
      availability,
      occupancy,
      conflicts: [],
    };

    const conflicts = this.detectConflicts(item, source, context);
    item.conflicts = conflicts;
    item.status.operational = this.evaluateOperationalStatus(item, conflicts);

    if (conflicts.length > 0) {
      logger.warn('[InventoryEngine] Inventory diagnostics detected', {
        placaId: item.placaId,
        conflicts: conflicts.map((conflict) => conflict.code),
      });
    }

    return { item, diagnostics: conflicts };
  }

  evaluateAvailability(source: InventorySource, now = new Date()) {
    return calculateAvailability(source, now);
  }

  evaluateOccupancy(source: InventorySource, now = new Date()): InventoryOccupancy {
    const activeSourceIds: string[] = [];
    const futureSourceIds: string[] = [];

    (source.alugueis ?? []).forEach((aluguel, index) => {
      if (aluguel.status === 'cancelado' || aluguel.status === 'finalizado') return;
      const startDate = toDate(aluguel.startDate);
      const endDate = toDate(aluguel.endDate);
      const id = aluguel.id ?? `aluguel:${index}`;

      if (startDate && endDate && startDate <= now && endDate >= now) {
        activeSourceIds.push(id);
      } else if (startDate && startDate > now) {
        futureSourceIds.push(id);
      }
    });

    return {
      occupied: activeSourceIds.length > 0 || source.placa.aluguel_ativo === true,
      reserved: futureSourceIds.length > 0 || source.placa.aluguel_futuro === true,
      activeSourceIds,
      futureSourceIds,
    };
  }

  detectConflicts(
    item: InventoryItem,
    source: InventorySource,
    context: InventoryEvaluationContext = {},
  ): InventoryConflict[] {
    return detectInventoryConflicts(item, source, context.sources ?? []);
  }

  normalizeInventorySource(input: InventorySource): InventorySource {
    return {
      placa: {
        ...input.placa,
        _id: input.placa._id ?? input.placa.id,
        disponivel: input.placa.disponivel ?? input.placa.ativa ?? null,
      },
      alugueis: input.alugueis ?? [],
      contratos: input.contratos ?? [],
      usedOnMap: input.usedOnMap ?? true,
    };
  }

  buildInventorySummary(
    sources: InventorySource[],
    context: InventoryEvaluationContext = {},
  ): InventorySummary {
    const evaluationContext = { ...context, sources };
    const results = sources.map((source) => this.evaluateInventoryItem(source, evaluationContext));
    const diagnostics = results.flatMap((result) => result.diagnostics);

    return results.reduce<InventorySummary>((summary, result) => {
      summary.total += 1;
      summary[result.item.availability.status] += 1;

      if (result.item.status.operational === 'healthy') summary.healthy += 1;
      if (result.item.status.operational === 'attention') summary.attention += 1;
      if (result.item.status.operational === 'incomplete') summary.incomplete += 1;
      summary.conflicts += result.item.conflicts.length;
      summary.diagnostics = diagnostics;
      return summary;
    }, {
      total: 0,
      available: 0,
      reserved: 0,
      occupied: 0,
      unavailable: 0,
      unknown: 0,
      healthy: 0,
      attention: 0,
      conflicts: 0,
      incomplete: 0,
      diagnostics,
    });
  }

  private evaluatePhysicalStatus(source: InventorySource) {
    const available = source.placa.disponivel ?? source.placa.ativa;
    if (available === true) return 'active' as const;
    if (available === false) return 'inactive' as const;
    return 'unknown' as const;
  }

  private evaluateOperationalStatus(
    item: InventoryItem,
    conflicts: InventoryConflict[],
  ) {
    if (conflicts.some((conflict) => conflict.code === 'MISSING_OPERATIONAL_NUMBER' || conflict.code === 'INVALID_MAP_COORDINATES')) {
      return 'incomplete' as const;
    }
    if (conflicts.length > 0) return 'conflict' as const;
    if (item.status.physical === 'unknown' || item.status.commercial === 'unknown') return 'attention' as const;
    return 'healthy' as const;
  }
}

export const inventoryService = new InventoryService();
