import Placa from '@modules/placas/Placa';
import Aluguel from '@modules/alugueis/Aluguel';

type BoardStatus = 'occupied' | 'available' | 'reserved' | 'maintenance' | 'critical';

const STATUS_LABELS: Record<BoardStatus, string> = {
  occupied: 'Ocupadas',
  available: 'Disponíveis',
  reserved: 'Reservadas',
  maintenance: 'Manutenção',
  critical: 'Críticas',
};

function toDate(input: unknown): Date | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(String(input));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(input: unknown): number {
  const value = Number(input ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function toId(input: unknown): string {
  if (!input) return '';
  return String((input as any)?._id ?? (input as any)?.id ?? input);
}

function isActiveRental(aluguel: any, now: Date): boolean {
  if (aluguel?.status === 'cancelado' || aluguel?.status === 'finalizado') return false;
  const start = toDate(aluguel?.startDate ?? aluguel?.data_inicio);
  const end = toDate(aluguel?.endDate ?? aluguel?.data_fim);
  return Boolean(start && end && start <= now && end >= now);
}

function isFutureRental(aluguel: any, now: Date): boolean {
  if (aluguel?.status === 'cancelado' || aluguel?.status === 'finalizado') return false;
  const start = toDate(aluguel?.startDate ?? aluguel?.data_inicio);
  return Boolean(start && start > now);
}

function getRentalEnd(aluguel: any): Date | null {
  return toDate(aluguel?.endDate ?? aluguel?.data_fim);
}

function getBoardStatus(placa: any, alugueis: any[], now: Date): BoardStatus {
  if (alugueis.some((aluguel) => isActiveRental(aluguel, now))) return 'occupied';
  if (alugueis.some((aluguel) => isFutureRental(aluguel, now))) return 'reserved';
  if ((placa?.disponivel ?? placa?.ativa ?? true) === false) return 'maintenance';
  return 'available';
}

function roundRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

export class InventorySummaryService {
  async getSummary(empresaId: string) {
    const now = new Date();
    const placas = await Placa.find({ empresaId }).populate('regiaoId', 'nome codigo').lean();
    const placaIds = placas.map((placa: any) => placa._id);

    const alugueis = placaIds.length > 0
      ? await Aluguel.find({
          empresaId,
          status: { $ne: 'cancelado' },
          $or: [
            { placaId: { $in: placaIds } },
            { placa: { $in: placaIds } },
          ],
        }).lean()
      : [];

    const alugueisPorPlaca = new Map<string, any[]>();
    alugueis.forEach((aluguel: any) => {
      const placaId = toId(aluguel.placaId ?? aluguel.placa);
      if (!placaId) return;
      if (!alugueisPorPlaca.has(placaId)) alugueisPorPlaca.set(placaId, []);
      alugueisPorPlaca.get(placaId)!.push(aluguel);
    });

    const totals = {
      totalBoards: placas.length,
      occupiedBoards: 0,
      availableBoards: 0,
      reservedBoards: 0,
      maintenanceBoards: 0,
      criticalBoards: 0,
    };

    const revenue = {
      activeMonthlyRevenue: 0,
      estimatedAvailableRevenue: 0,
      projectedMonthlyRevenue: 0,
    };

    const regionMap = new Map<string, any>();
    const criticalBoards: any[] = [];
    const idleBoards: any[] = [];
    const statusCounts: Record<BoardStatus, number> = {
      occupied: 0,
      available: 0,
      reserved: 0,
      maintenance: 0,
      critical: 0,
    };

    placas.forEach((placa: any) => {
      const boardRentals = alugueisPorPlaca.get(String(placa._id)) ?? [];
      const status = getBoardStatus(placa, boardRentals, now);
      const value = toNumber(placa.valor_mensal);
      const regiaoRaw = placa.regiaoId;
      const regionId = toId(regiaoRaw) || 'sem-regiao';
      const regionName = typeof regiaoRaw === 'object' && regiaoRaw?.nome ? regiaoRaw.nome : 'Sem região';

      statusCounts[status] += 1;
      if (status === 'occupied') {
        totals.occupiedBoards += 1;
        revenue.activeMonthlyRevenue += value;
      } else if (status === 'available') {
        totals.availableBoards += 1;
        revenue.estimatedAvailableRevenue += value;
      } else if (status === 'reserved') {
        totals.reservedBoards += 1;
      } else if (status === 'maintenance') {
        totals.maintenanceBoards += 1;
      } else if (status === 'critical') {
        totals.criticalBoards += 1;
      }

      if (!regionMap.has(regionId)) {
        regionMap.set(regionId, {
          id: regionId,
          name: regionName,
          totalBoards: 0,
          occupiedBoards: 0,
          availableBoards: 0,
          activeRevenue: 0,
          criticalCount: 0,
        });
      }

      const region = regionMap.get(regionId);
      region.totalBoards += 1;
      if (status === 'occupied') {
        region.occupiedBoards += 1;
        region.activeRevenue += value;
      }
      if (status === 'available') region.availableBoards += 1;
      if (status === 'critical') {
        region.criticalCount += 1;
        criticalBoards.push({
          id: String(placa._id),
          code: placa.numero_placa,
          region: regionName,
        });
      }

      if (status === 'available') {
        const latestEnd = boardRentals
          .map(getRentalEnd)
          .filter(Boolean)
          .sort((a: any, b: any) => b.getTime() - a.getTime())[0] as Date | undefined;

        if (latestEnd) {
          const idleDays = Math.floor((now.getTime() - latestEnd.getTime()) / 86400000);
          if (idleDays > 0) {
            idleBoards.push({
              id: String(placa._id),
              code: placa.numero_placa,
              region: regionName,
              idleDays,
            });
          }
        }
      }
    });

    revenue.projectedMonthlyRevenue = revenue.activeMonthlyRevenue + revenue.estimatedAvailableRevenue;

    const total = Math.max(totals.totalBoards, 1);
    const regions = Array.from(regionMap.values()).map((region) => ({
      ...region,
      occupancyRate: roundRate(region.totalBoards > 0 ? region.occupiedBoards / region.totalBoards : 0),
    }));

    const statusDistribution = (Object.keys(statusCounts) as BoardStatus[]).map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: statusCounts[status],
      percentage: roundRate(statusCounts[status] / total),
    }));

    const activeRentalEnds = alugueis
      .filter((aluguel: any) => isActiveRental(aluguel, now))
      .map(getRentalEnd)
      .filter(Boolean) as Date[];

    const countExpiring = (days: number) => {
      const limit = new Date(now);
      limit.setDate(limit.getDate() + days);
      return activeRentalEnds.filter((end) => end >= now && end <= limit).length;
    };

    return {
      generatedAt: now.toISOString(),
      totals,
      occupancy: {
        rate: roundRate(totals.occupiedBoards / total),
        availableRate: roundRate(totals.availableBoards / total),
        reservedRate: roundRate(totals.reservedBoards / total),
        maintenanceRate: roundRate(totals.maintenanceBoards / total),
      },
      revenue,
      regions,
      statusDistribution,
      expiringContracts: {
        next7Days: countExpiring(7),
        next15Days: countExpiring(15),
        next30Days: countExpiring(30),
      },
      highlights: {
        topRegions: [...regions].sort((a, b) => b.occupiedBoards - a.occupiedBoards).slice(0, 5),
        lowOccupancyRegions: [...regions].filter((region) => region.totalBoards > 0 && region.occupancyRate < 0.3).slice(0, 5),
        criticalBoards,
        idleBoards: idleBoards.sort((a, b) => b.idleDays - a.idleDays).slice(0, 10),
      },
    };
  }
}
