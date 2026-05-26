import { spatialService } from '@modules/spatial';
import type {
  InventoryConflict,
  InventoryItem,
  InventorySource,
} from '../contracts/inventory.contracts';

function sourceId(source: InventorySource): string | undefined {
  const raw = source.placa._id ?? source.placa.id;
  return raw === undefined || raw === null ? undefined : String(raw);
}

function hasActiveContract(source: InventorySource): boolean {
  return (source.contratos ?? []).some((contrato) => contrato.status === 'ativo');
}

export function detectInventoryConflicts(
  item: InventoryItem,
  source: InventorySource,
  allSources: InventorySource[] = [],
): InventoryConflict[] {
  const conflicts: InventoryConflict[] = [];
  const placaId = item.placaId || sourceId(source);

  if (item.availability.status === 'available' && hasActiveContract(source)) {
    conflicts.push({
      code: 'AVAILABLE_WITH_ACTIVE_CONTRACT',
      severity: 'warning',
      message: 'Placa marcada como disponivel, mas vinculada a contrato ativo.',
      placaId,
    });
  }

  if (
    item.availability.status === 'occupied' &&
    item.occupancy.activeSourceIds.length === 0 &&
    !hasActiveContract(source)
  ) {
    conflicts.push({
      code: 'OCCUPIED_WITHOUT_OPERATIONAL_LINK',
      severity: 'warning',
      message: 'Placa ocupada sem aluguel ou contrato ativo claro.',
      placaId,
    });
  }

  if (source.usedOnMap !== false) {
    const coordinates = source.placa.coordenadas;
    const validCoordinates = coordinates ? spatialService.validateCoordinates(coordinates).ok : false;
    if (!validCoordinates) {
      conflicts.push({
        code: 'INVALID_MAP_COORDINATES',
        severity: 'warning',
        message: 'Placa sem coordenada valida para uso no mapa.',
        placaId,
      });
    }
  }

  if (typeof source.placa.numeroOperacional !== 'number') {
    conflicts.push({
      code: 'MISSING_OPERATIONAL_NUMBER',
      severity: 'warning',
      message: 'Placa sem numero operacional.',
      placaId,
    });
  }

  if (typeof source.placa.numeroOperacional === 'number') {
    const empresaId = source.placa.empresaId === undefined ? undefined : String(source.placa.empresaId);
    const regiaoId = source.placa.regiaoId === undefined ? undefined : String(source.placa.regiaoId);
    const duplicates = allSources.filter((candidate) => {
      if (candidate === source) return false;
      return (
        candidate.placa.numeroOperacional === source.placa.numeroOperacional &&
        String(candidate.placa.empresaId) === empresaId &&
        String(candidate.placa.regiaoId) === regiaoId
      );
    });

    if (duplicates.length > 0) {
      conflicts.push({
        code: 'DUPLICATED_OPERATIONAL_NUMBER',
        severity: 'warning',
        message: 'Numero operacional duplicado na mesma empresa/regiao.',
        placaId,
        meta: {
          numeroOperacional: source.placa.numeroOperacional,
          duplicates: duplicates.map((candidate) => sourceId(candidate)).filter(Boolean),
        },
      });
    }
  }

  return conflicts;
}
