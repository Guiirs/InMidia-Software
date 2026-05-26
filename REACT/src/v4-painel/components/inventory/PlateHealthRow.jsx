import { memo } from 'react';

function getHealthVariant(score) {
  if (score >= 80) return { label: 'Saudável', color: '#10b981' };
  if (score >= 50) return { label: 'Atenção',  color: '#f59e0b' };
  return               { label: 'Crítico',   color: '#ef4444' };
}

function PlateHealthRow({ board, vencFormatted, revenueColor }) {
  const score   = board?.healthScore ?? null;
  const revenue = board?.receitaFormatada ?? null;
  const status  = board?.status ?? 'idle';

  const hasScore  = score !== null && typeof score === 'number';
  const variant   = hasScore ? getHealthVariant(score) : null;
  const isLowHealth = hasScore && score < 50;

  const revColor = revenueColor ?? (variant?.color ?? 'var(--v4p-text-3)');
  const revLabel = status === 'available' ? 'Potencial' : null;

  return (
    <div className="plate-health-row">
      {hasScore && (
        <div className="plate-health-row__score-line">
          <div className="plate-health-row__bar-track" aria-hidden="true">
            <div
              className="plate-health-row__bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: variant.color }}
            />
          </div>
          {isLowHealth && (
            <span
              className="material-symbols-rounded plate-health-row__alert-icon"
              style={{ color: variant.color }}
              aria-hidden="true"
            >
              warning
            </span>
          )}
        </div>
      )}

      <div className="plate-health-row__revenue-line">
        {revenue && (
          <span className="plate-health-row__revenue" style={{ color: revColor }}>
            {revLabel && (
              <span className="plate-health-row__rev-prefix">{revLabel} · </span>
            )}
            {revenue}
          </span>
        )}
        {vencFormatted && (
          <span className="plate-health-row__expiry">
            <span className="material-symbols-rounded" style={{ fontSize: 10 }}>event</span>
            {vencFormatted}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(PlateHealthRow);
