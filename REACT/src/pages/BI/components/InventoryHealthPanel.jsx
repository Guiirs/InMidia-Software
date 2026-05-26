import React from 'react';
import { formatCount, formatPercent, metricValue } from '../utils/biFormatters';

function InventoryRow({ label, value, testId }) {
  return (
    <div className="bi-inventory-row" data-testid={testId}>
      <span className="bi-inventory-row__label">{label}</span>
      <span className="bi-inventory-row__value">{value}</span>
    </div>
  );
}

export default function InventoryHealthPanel({ dataset }) {
  if (!dataset) {
    return (
      <div className="bi-inventory-panel bi-panel--empty" data-testid="inventory-health-panel">
        <p className="bi-panel__empty">Dados de inventário indisponíveis.</p>
      </div>
    );
  }

  const metrics = dataset.metrics ?? [];
  const rows = dataset.rows ?? [];

  const total = metricValue(metrics, 'total_assets') ?? metricValue(metrics, 'totalAssets') ?? rows.length;
  const available = rows.filter((r) => r.availability === 'available').length;
  const occupied = rows.filter((r) => r.availability === 'occupied').length;
  const reserved = rows.filter((r) => r.availability === 'reserved').length;
  const unavailable = rows.filter((r) => r.availability === 'unavailable').length;
  const incomplete = metricValue(metrics, 'incomplete_assets') ?? metricValue(metrics, 'incompleteAssets') ?? 0;
  const conflicts = metricValue(metrics, 'conflicts') ?? 0;

  return (
    <div className="bi-inventory-panel" data-testid="inventory-health-panel">
      <InventoryRow label="Total de Ativos" value={formatCount(total)} testId="inv-total" />
      <InventoryRow label="Disponíveis" value={formatCount(available)} testId="inv-available" />
      <InventoryRow label="Ocupados" value={formatCount(occupied)} testId="inv-occupied" />
      <InventoryRow label="Reservados" value={formatCount(reserved)} testId="inv-reserved" />
      <InventoryRow label="Indisponíveis" value={formatCount(unavailable)} testId="inv-unavailable" />
      <InventoryRow label="Registros Incompletos" value={formatCount(incomplete)} testId="inv-incomplete" />
      <InventoryRow label="Conflitos Ativos" value={formatCount(conflicts)} testId="inv-conflicts" />
      {total > 0 && (
        <InventoryRow
          label="Taxa de Disponibilidade"
          value={formatPercent((available / total) * 100)}
          testId="inv-rate"
        />
      )}
    </div>
  );
}
