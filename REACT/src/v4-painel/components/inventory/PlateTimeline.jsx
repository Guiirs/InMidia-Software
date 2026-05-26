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

function fillRatio(startStr, endStr) {
  const endDays  = diffDays(endStr);
  const startD   = parseDateLocal(startStr);
  if (endDays === null) return 0.5;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const elapsedDays = startD ? Math.round((today - startD) / 86400000) : null;
  if (elapsedDays === null) return 0.5;
  const total = elapsedDays + Math.max(0, endDays);
  if (total <= 0) return 1;
  return Math.max(0.04, Math.min(0.96, elapsedDays / total));
}

const C = {
  occupied:    '#10b981',
  available:   '#06b6d4',
  reserved:    '#8b5cf6',
  critical:    '#ef4444',
  maintenance: '#f59e0b',
  idle:        'rgba(100,116,139,0.45)',
};

function resolve(board) {
  const s    = board?.status ?? 'idle';
  const venc = board?.vencimento ?? board?.dataVencimento ?? board?.endDate ?? null;
  const ini  = board?.inicioContrato ?? board?.dataInicio ?? board?.startDate ?? null;
  const dr   = diffDays(venc);

  switch (s) {
    case 'maintenance':
      return { msg: 'Indisponível operacionalmente', color: C.maintenance, bar: false };

    case 'critical': {
      if (dr !== null) {
        return {
          msg:  dr <= 0 ? 'Vencido · ação urgente' : `Vence em ${dr}d · atenção`,
          color: C.critical,
          bar:  true,
          fill: dr <= 0 ? 1 : fillRatio(ini, venc),
        };
      }
      return { msg: 'Situação crítica · verificar', color: C.critical, bar: false };
    }

    case 'occupied': {
      if (dr === null) return { msg: 'Contrato ativo', color: C.occupied, bar: false };
      if (dr <= 0)    return { msg: 'Contrato vencido', color: C.critical, bar: true, fill: 1 };
      if (dr <= 5)    return { msg: `Vence em ${dr}d · atenção`, color: C.critical, bar: true, fill: fillRatio(ini, venc) };
      return { msg: `Contrato ativo · ${dr}d restantes`, color: C.occupied, bar: true, fill: fillRatio(ini, venc) };
    }

    case 'reserved': {
      const iniDays = diffDays(ini);
      if (iniDays !== null && iniDays > 0)
        return { msg: `Reserva futura · inicia em ${iniDays}d`, color: C.reserved, bar: false };
      if (dr !== null && dr > 0)
        return { msg: `Reserva futura · inicia em ${dr}d`, color: C.reserved, bar: false };
      return { msg: 'Reserva ativa', color: C.reserved, bar: false };
    }

    case 'available': {
      const resIni  = board?.reservaFutura?.inicio ?? board?.proximaReserva?.inicio ?? null;
      const resDays = diffDays(resIni);
      if (resDays !== null && resDays > 0)
        return { msg: `Reserva futura · inicia em ${resDays}d`, color: C.reserved, bar: false };
      return { msg: 'Livre agora · sem reserva futura', color: C.available, bar: false };
    }

    default: {
      if (board?.diasOcioso)
        return { msg: `Ocioso há ${board.diasOcioso} dias`, color: C.idle, bar: false };
      return null;
    }
  }
}

function PlateTimeline({ board }) {
  const data = resolve(board);
  if (!data) return null;

  const fill      = data.bar ? Math.max(0, Math.min(1, data.fill ?? 0.5)) : 0;
  const isNeutral = data.color === C.occupied || data.color === C.available;
  const msgColor  = isNeutral ? 'var(--v4p-text-3)' : data.color;

  return (
    <div className="plate-timeline">
      {data.bar && (
        <div className="plate-timeline__track" aria-hidden="true">
          <div
            className="plate-timeline__fill"
            style={{ width: `${Math.round(fill * 100)}%`, background: data.color }}
          />
          {fill > 0.03 && fill < 0.97 && (
            <div
              className="plate-timeline__today"
              style={{ left: `${Math.round(fill * 100)}%`, borderColor: data.color }}
            />
          )}
        </div>
      )}
      <span className="plate-timeline__msg" style={{ color: msgColor }}>
        {data.msg}
      </span>
    </div>
  );
}

export default memo(PlateTimeline);
