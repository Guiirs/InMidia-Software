import { memo } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';
import { getSeverityMeta } from '../../foundation/severityLevels.js';

const RISCO_ICON = { HIGH: 'error', MEDIUM: 'warning', LOW: 'info' };

function CriticalBoardRow({ board, isLast }) {
  const stateMeta    = getStateMeta(board.estado);
  const severityMeta = getSeverityMeta(board.risco);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        padding: '10px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--v4p-border-soft)',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
        {/* Ícone de estado */}
        <span
          aria-hidden="true"
          className="material-symbols-rounded"
          style={{
            fontSize: 18,
            color: stateMeta.color,
            lineHeight: 1.2,
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {board.estado === 'critical' ? 'crisis_alert' : 'warning'}
        </span>

        <div style={{ minWidth: 0 }}>
          {/* Código + nome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
            <span className="v4p-mono" style={{ color: stateMeta.color, fontSize: 11 }}>{board.codigo}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v4p-text-1)' }}>{board.label}</span>
          </div>
          {/* Região + motivo */}
          <div style={{ fontSize: 11, color: 'var(--v4p-text-3)', marginBottom: 4 }}>
            <span style={{ color: 'var(--v4p-text-4)' }}>{board.regiao}</span>
            {' · '}
            {board.motivo}
          </div>
          {/* Ação recomendada */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 12, color: 'var(--v4p-text-4)' }}>arrow_forward</span>
            <span style={{ fontSize: 11, color: 'var(--v4p-text-3)', fontStyle: 'italic' }}>{board.acao}</span>
          </div>
        </div>
      </div>

      {/* Impacto + responsável */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: severityMeta.color }}>{board.impacto}</span>
        <span style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{board.responsavel}</span>
        <span
          className="v4p-status-pill v4p-status-pill--sm"
          style={{
            color: stateMeta.color,
            borderColor: `color-mix(in srgb, ${stateMeta.color} 34%, transparent)`,
            background: `color-mix(in srgb, ${stateMeta.color} 12%, transparent)`,
          }}
        >
          {stateMeta.label}
        </span>
      </div>
    </div>
  );
}

function CriticalBoardsList({ boards = [] }) {
  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--v4p-danger)' }}>crisis_alert</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Placas críticas</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{boards.length} itens — ação imediata necessária</div>
        </div>
      </div>
      {boards.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--v4p-text-4)', padding: '12px 0' }}>Nenhuma placa em estado crítico.</div>
      ) : (
        boards.map((board, i) => (
          <CriticalBoardRow key={board.id} board={board} isLast={i === boards.length - 1} />
        ))
      )}
    </div>
  );
}

export default memo(CriticalBoardsList);
