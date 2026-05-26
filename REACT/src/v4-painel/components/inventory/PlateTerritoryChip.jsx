import { memo } from 'react';

const PALETTE = [
  '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
];

function hashColor(str) {
  if (!str) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function resolveRegion(board) {
  return board?.siglaRegiao
    ?? board?.regionName
    ?? board?.regiao
    ?? board?.regionalLot
    ?? board?.lote
    ?? null;
}

function PlateTerritoryChip({ board }) {
  const region = resolveRegion(board);
  const label  = region ? String(region).toUpperCase() : 'SEM REGIÃO';
  const color  = hashColor(region);

  return (
    <span
      className="plate-territory-chip"
      title={label}
      style={{ '--pter-color': color }}
    >
      <span className="plate-territory-chip__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export default memo(PlateTerritoryChip);
