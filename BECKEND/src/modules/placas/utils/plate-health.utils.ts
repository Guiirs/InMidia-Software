/**
 * Plate Health Score
 *
 * Calcula o índice de saúde de uma placa com base em critérios
 * de completude e consistência do cadastro.
 */

import type { PlateHealthResult, PlateHealthStatus } from '../dtos/placa.dto';

interface PlateHealthInput {
  numero_placa?: string;
  endereco?: string;
  nomeDaRua?: string;
  localizacao?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordenadas?: string | null;
  imagemPrincipal?: string | null;
  imagem?: string | null;
  imagens?: Array<unknown>;
  regiaoId?: unknown;
  regionId?: unknown;
  statusOperacional?: string | null;
  statusComercial?: string | null;
  disponivel?: boolean;
  archivedAt?: Date | null;
  // temporal status (opcional — injetado pelo service quando disponível)
  temporalStatus?: string | null;
}

const VALID_OPERATIONAL_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ARCHIVED']);
const VALID_COMMERCIAL_STATUSES  = new Set(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'UNAVAILABLE']);

function hasCoordinates(input: PlateHealthInput): boolean {
  if (input.latitude != null && input.longitude != null) return true;
  if (typeof input.coordenadas === 'string' && input.coordenadas.includes(',')) {
    const [lat, lng] = input.coordenadas.split(',').map(Number);
    return !Number.isNaN(lat) && !Number.isNaN(lng);
  }
  return false;
}

function hasMainImage(input: PlateHealthInput): boolean {
  return !!(input.imagemPrincipal || input.imagem || (Array.isArray(input.imagens) && input.imagens.length > 0));
}

function hasRegion(input: PlateHealthInput): boolean {
  const r = input.regiaoId ?? input.regionId;
  return r != null && String(r) !== '';
}

function hasAddress(input: PlateHealthInput): boolean {
  return !!(input.endereco || input.nomeDaRua || input.localizacao);
}

function hasValidStatus(input: PlateHealthInput): boolean {
  const opOk  = !input.statusOperacional || VALID_OPERATIONAL_STATUSES.has(input.statusOperacional);
  const comOk = !input.statusComercial  || VALID_COMMERCIAL_STATUSES.has(input.statusComercial);
  return opOk && comOk;
}

function hasTemporalConsistency(input: PlateHealthInput): boolean {
  const status = input.temporalStatus;
  if (!status) return true;
  if (status === 'CONTRACTED_ACTIVE' && input.disponivel === true) return false; // ocupada mas marcada disponível
  return true;
}

/**
 * Calcula o índice de saúde da placa.
 *
 * Cada critério vale 1 ponto. Score = pontos / total * 100.
 * - 80-100 → HEALTHY
 * - 50-79  → ATTENTION
 * - 0-49   → CRITICAL
 */
export function resolvePlateHealth(input: PlateHealthInput): PlateHealthResult {
  const checks: Array<{ label: string; pass: boolean }> = [
    { label: 'Possui número da placa',     pass: !!(input.numero_placa?.trim()) },
    { label: 'Possui endereço',            pass: hasAddress(input) },
    { label: 'Possui coordenadas',         pass: hasCoordinates(input) },
    { label: 'Possui imagem principal',    pass: hasMainImage(input) },
    { label: 'Possui região',              pass: hasRegion(input) },
    { label: 'Status válido',              pass: hasValidStatus(input) },
    { label: 'Consistência temporal',      pass: hasTemporalConsistency(input) },
  ];

  const passed = checks.filter((c) => c.pass).length;
  const score  = Math.round((passed / checks.length) * 100);
  const issues = checks.filter((c) => !c.pass).map((c) => c.label);

  let status: PlateHealthStatus;
  if (score >= 80) status = 'HEALTHY';
  else if (score >= 50) status = 'ATTENTION';
  else status = 'CRITICAL';

  return { score, status, issues };
}
