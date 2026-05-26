import { memo } from 'react';

function parseDateLocal(str) {
  if (!str || typeof str !== 'string') return null;
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(dateStr) {
  const d = parseDateLocal(dateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function resolveAlert(board) {
  const status = board?.status ?? 'idle';
  const score  = board?.healthScore ?? null;
  const venc   = board?.vencimento ?? board?.dataVencimento ?? null;
  const alerts = board?.alertas;
  const dr     = diffDays(venc);

  if (status === 'critical')
    return { level: 'critical', msg: 'Status crítico — atenção imediata', pulse: true };

  if (Array.isArray(alerts) && alerts.length > 0)
    return { level: 'critical', msg: `${alerts.length} alerta(s) ativo(s)`, pulse: true };

  if (typeof score === 'number' && score < 50)
    return { level: 'warning', msg: `Health score baixo: ${score}`, pulse: false };

  if (dr !== null && dr >= 0 && dr <= 5)
    return { level: 'warning', msg: `Vencimento em ${dr} dia(s)`, pulse: false };

  return null;
}

function PlateAlertDot({ board }) {
  const alert = resolveAlert(board);
  if (!alert) return null;

  const color = alert.level === 'critical' ? '#ef4444' : '#f59e0b';

  return (
    <span
      className={`plate-alert-dot${alert.pulse ? ' plate-alert-dot--pulse' : ''}`}
      style={{ '--pad-color': color }}
      title={alert.msg}
      aria-label={alert.msg}
      role="status"
    />
  );
}

export default memo(PlateAlertDot);
