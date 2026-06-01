import type { CommercialStatus } from '@modules/commercial-projection/commercial-projection.types';

/**
 * Legacy statusComercial values persisted in the Placa schema.
 * Kept for backward compatibility; canonical source is CommercialStatus.
 */
export type LegacyStatusComercial = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'UNAVAILABLE';

/**
 * Maps the canonical CommercialStatus (Commercial Projection) to the legacy
 * statusComercial enum stored in the Placa schema.
 *
 * Use this whenever a response field named `statusComercial` must remain
 * compatible with the old four-value enum while the canonical CP status
 * (`commercialProjection.commercialStatus`) carries the full V4 semantics.
 *
 * Mapping:
 *   AVAILABLE         → AVAILABLE
 *   RESERVED          → RESERVED
 *   FUTURE_RESERVED   → RESERVED   (both represent "not yet active" reservation)
 *   CONTRACTED_ACTIVE → OCCUPIED
 *   MAINTENANCE       → UNAVAILABLE
 *   UNKNOWN           → UNAVAILABLE (safe default)
 *   <unknown value>   → UNAVAILABLE (safe default)
 *
 * @deprecated The `statusComercial` field itself is legacy.
 * Prefer `commercialProjection.commercialStatus` for all V4 logic.
 */
export function mapCommercialStatusToLegacyStatusComercial(
  commercialStatus: CommercialStatus | string,
): LegacyStatusComercial {
  switch (commercialStatus) {
    case 'AVAILABLE':         return 'AVAILABLE';
    case 'RESERVED':          return 'RESERVED';
    case 'FUTURE_RESERVED':   return 'RESERVED';
    case 'CONTRACTED_ACTIVE': return 'OCCUPIED';
    case 'MAINTENANCE':       return 'UNAVAILABLE';
    case 'UNKNOWN':
    default:                  return 'UNAVAILABLE';
  }
}
