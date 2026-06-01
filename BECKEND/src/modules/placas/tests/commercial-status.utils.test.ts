/**
 * Unit tests — mapCommercialStatusToLegacyStatusComercial()
 *
 * Pure function — no mocks needed.
 * Validates the canonical CommercialStatus → legacy statusComercial mapping.
 */

import { mapCommercialStatusToLegacyStatusComercial } from '../utils/commercial-status.utils';

describe('mapCommercialStatusToLegacyStatusComercial', () => {
  it('SC1 — CONTRACTED_ACTIVE → OCCUPIED', () => {
    expect(mapCommercialStatusToLegacyStatusComercial('CONTRACTED_ACTIVE')).toBe('OCCUPIED');
  });

  it('SC2 — FUTURE_RESERVED → RESERVED', () => {
    expect(mapCommercialStatusToLegacyStatusComercial('FUTURE_RESERVED')).toBe('RESERVED');
  });

  it('SC3 — MAINTENANCE → UNAVAILABLE', () => {
    expect(mapCommercialStatusToLegacyStatusComercial('MAINTENANCE')).toBe('UNAVAILABLE');
  });

  it('SC4 — UNKNOWN → UNAVAILABLE (safe default)', () => {
    expect(mapCommercialStatusToLegacyStatusComercial('UNKNOWN')).toBe('UNAVAILABLE');
  });

  it('SC5 — AVAILABLE → AVAILABLE', () => {
    expect(mapCommercialStatusToLegacyStatusComercial('AVAILABLE')).toBe('AVAILABLE');
  });

  it('SC6 — RESERVED → RESERVED', () => {
    expect(mapCommercialStatusToLegacyStatusComercial('RESERVED')).toBe('RESERVED');
  });

  it('SC7 — valor desconhecido → UNAVAILABLE (safe default)', () => {
    expect(mapCommercialStatusToLegacyStatusComercial('XPTO_UNKNOWN' as any)).toBe('UNAVAILABLE');
  });

  it('SC8 — string vazia → UNAVAILABLE (safe default)', () => {
    expect(mapCommercialStatusToLegacyStatusComercial('' as any)).toBe('UNAVAILABLE');
  });
});
