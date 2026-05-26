import type { EnterpriseBIFilter, EnterpriseBIQuery, EnterpriseBIRecord } from '../contracts/enterprise-bi.contracts';

function includesValue(value: unknown, expected: Array<string | number>): boolean {
  return expected.some((item) => String(item) === String(value));
}

function compareNumber(value: number | undefined, filter: EnterpriseBIFilter): boolean {
  if (typeof value !== 'number') return false;
  if (filter.operator === 'gte') return value >= Number(filter.value);
  if (filter.operator === 'lte') return value <= Number(filter.value);
  if (filter.operator === 'between' && filter.value && typeof filter.value === 'object' && !Array.isArray(filter.value)) {
    const range = filter.value as { start?: string; end?: string };
    const start = range.start ? Number(range.start) : Number.NEGATIVE_INFINITY;
    const end = range.end ? Number(range.end) : Number.POSITIVE_INFINITY;
    return value >= start && value <= end;
  }
  if (filter.operator === 'eq') return value === Number(filter.value);
  if (filter.operator === 'ne') return value !== Number(filter.value);
  return false;
}

function compareString(value: string | undefined, filter: EnterpriseBIFilter): boolean {
  if (typeof value !== 'string') return false;
  if (filter.operator === 'exists') return true;
  if (filter.operator === 'contains' && typeof filter.value === 'string') return value.toLowerCase().includes(filter.value.toLowerCase());
  if (filter.operator === 'eq' && typeof filter.value === 'string') return value === filter.value;
  if (filter.operator === 'ne' && typeof filter.value === 'string') return value !== filter.value;
  if (filter.operator === 'in' && Array.isArray(filter.value)) return includesValue(value, filter.value);
  return false;
}

export function applyEnterpriseBIFilters(rows: EnterpriseBIRecord[], query: EnterpriseBIQuery): EnterpriseBIRecord[] {
  const filters = query.filters ?? [];

  return rows.filter((row) => filters.every((filter) => {
    if (filter.field === 'tenantId') return compareString(row.tenantId, filter);
    if (filter.field === 'empresaId') return compareString(row.empresaId, filter);
    if (filter.field === 'regiaoId') return compareString(row.regiaoId, filter);
    if (filter.field === 'placaId') return compareString(row.placaId, filter);
    if (filter.field === 'status') return compareString(row.status, filter);
    if (filter.field === 'availability') return compareString(row.availability, filter);
    if (filter.field === 'occupancyRate') return compareNumber(row.occupancyRate, filter);
    if (filter.field === 'qualityScore') return compareNumber(row.qualityScore, filter);
    if (filter.field === 'severity') return compareString(row.severity, filter);
    if (filter.field === 'mediaValid') {
      if (typeof filter.value !== 'boolean') return false;
      return filter.operator === 'eq' ? row.mediaValid === filter.value : filter.operator === 'ne' ? row.mediaValid !== filter.value : false;
    }
    if (filter.field === 'periodStart') {
      if (!row.period?.start || typeof filter.value !== 'string') return false;
      return filter.operator === 'gte' ? row.period.start >= filter.value : filter.operator === 'lte' ? row.period.start <= filter.value : row.period.start === filter.value;
    }
    if (filter.field === 'periodEnd') {
      if (!row.period?.end || typeof filter.value !== 'string') return false;
      return filter.operator === 'gte' ? row.period.end >= filter.value : filter.operator === 'lte' ? row.period.end <= filter.value : row.period.end === filter.value;
    }
    if (filter.field === 'grain') return compareString(row.grain, filter);
    if (filter.field === 'profile') return compareString(row.profile, filter);
    return false;
  }));
}
