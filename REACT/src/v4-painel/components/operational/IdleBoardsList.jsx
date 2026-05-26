import { memo } from 'react';

function IdleBoardRow({ board, isLast }) {
  const urgency = board.diasSemCampanha >= 20
    ? { color: 'var(--v4p-warning)', label: 'Alta urgência' }
    : board.diasSemCampanha >= 10
    ? { color: 'var(--v4p-accent)', label: 'Moderado' }
    : { color: 'var(--v4p-text-4)', label: 'Baixo' };

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
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          <span className="v4p-mono" style={{ color: 'var(--v4p-text-4)', fontSize: 11 }}>{board.codigo}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v4p-text-1)' }}>{board.label}</span>
          <span className="v4p-chip v4p-chip--sm v4p-chip--neutral">
            {board.categoria}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--v4p-text-4)', marginBottom: 3 }}>
          {board.regiao} · Visibilidade: {board.visibilidade}
        </div>
        <div style={{ fontSize: 11, color: 'var(--v4p-accent)' }}>
          {board.oportunidade}
        </div>
      </div>

      <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: urgency.color }}>{board.diasSemCampanha}d</span>
        <span style={{ fontSize: 9, color: 'var(--v4p-text-4)' }}>sem campanha</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--v4p-success)' }}>{board.potencial}</span>
      </div>
    </div>
  );
}

function IdleBoardsList({ boards = [] }) {
  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--v4p-warning)' }}>inventory_2</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Inventário ocioso</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{boards.length} posições — oportunidades comerciais identificadas</div>
        </div>
      </div>
      {boards.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--v4p-text-4)', padding: '12px 0' }}>Nenhuma placa ociosa no momento.</div>
      ) : (
        boards.map((board, i) => (
          <IdleBoardRow key={board.id} board={board} isLast={i === boards.length - 1} />
        ))
      )}
    </div>
  );
}

export default memo(IdleBoardsList);
