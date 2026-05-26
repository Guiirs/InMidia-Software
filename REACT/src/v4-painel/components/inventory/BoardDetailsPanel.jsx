import { memo } from 'react';
import BoardStatusBadge from './BoardStatusBadge.jsx';
import { getStateMeta } from '../../foundation/operationalStates.js';
import { getPriorityMeta } from '../../foundation/priorities.js';
import { getSeverityMeta } from '../../foundation/severityLevels.js';
import PlateImagePreview from '../media/PlateImagePreview.jsx';
import SafeImage from '../media/SafeImage.jsx';
import './BoardDetailsPanel.css';

function getActionLabel(board) {
  if (board.status === 'available') return 'Ofertar placa';
  if (board.status === 'critical' || board.status === 'maintenance') return 'Acionar operacao';
  if (board.status === 'reserved') return 'Confirmar renovacao';
  return 'Abrir contrato';
}

function getContractId(board) {
  const numeric = board.codigo.replace(/\D/g, '').slice(0, 4).padEnd(4, '0');
  return `CTR-${numeric}`;
}

function DetailRow({ label, value, valueColor }) {
  return (
    <div className="v4p-board-panel__row">
      <span>{label}</span>
      <strong style={{ color: valueColor }}>{value}</strong>
    </div>
  );
}

function BoardDetailsPanel({ board, onClose }) {
  if (!board) {
    return (
      <div className="v4p-board-panel v4p-board-panel--empty">
        <span aria-hidden="true" className="v4p-board-panel__empty-icon material-symbols-rounded">ads_click</span>
        <strong>Selecione uma placa</strong>
        <p>Clique em uma linha ou marcador para visualizar contrato, campanha e disponibilidade.</p>
      </div>
    );
  }

  const stateMeta = getStateMeta(board.estado);
  const priorityMeta = getPriorityMeta(board.prioridade);
  const riskMeta = getSeverityMeta(board.risco);
  const occupancyPct = Math.round((board.ocupacao ?? 0) * 100);
  const recentActivity = Array.isArray(board.activityHistory) ? board.activityHistory : [];
  const images = Array.isArray(board.images) ? board.images : Array.isArray(board.imagens) ? board.imagens : [];

  return (
    <aside className="v4p-board-panel" style={{ '--v4p-board-accent': stateMeta.color }}>
      <header className="v4p-board-panel__header">
        <div>
          <span className="v4p-board-panel__eyebrow">Detalhe operacional</span>
          <h2 className="v4p-mono">{board.codigo}</h2>
          <p>{board.nome}</p>
        </div>
        {onClose && (
          <button type="button" className="v4p-board-panel__close material-symbols-rounded" onClick={onClose} aria-label="Fechar detalhe">
            close
          </button>
        )}
      </header>

      <div className="v4p-board-panel__status">
        <BoardStatusBadge status={board.status} />
        <span style={{ '--v4p-chip-color': priorityMeta.color }}>{priorityMeta.label}</span>
      </div>

      <section className="v4p-board-panel__section">
        <div className="v4p-board-panel__section-title">Imagem da placa</div>
        <PlateImagePreview
          board={board}
          className="v4p-board-panel__main-image"
          fallbackClassName="v4p-board-panel__image-empty"
        />
        {images.length > 0 && (
          <div className="v4p-board-panel__gallery">
            {images.map((image) => (
              <div key={image.id ?? image._id ?? image.url} className="v4p-board-panel__gallery-item">
                <SafeImage src={image.url} alt={image.filename ?? `Imagem ${board.codigo}`} fallbackLabel="Sem imagem cadastrada" />
                {image.isMain && <span>Principal</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="v4p-board-panel__campaign">
        <div>
          <span>Campanha atual</span>
          <strong>{board.campanha ?? 'Disponivel para nova campanha'}</strong>
          <p>{board.cliente ? `Cliente: ${board.cliente}` : 'Sem cliente vinculado'}</p>
        </div>
      </section>

      <div className="v4p-board-panel__stats">
        <article>
          <span>Receita/mes</span>
          <strong>{board.receitaFormatada}</strong>
        </article>
        <article>
          <span>Disponibilidade</span>
          <strong>{board.ocupado ? 'Ocupada' : 'Livre'}</strong>
        </article>
      </div>

      <section className="v4p-board-panel__section">
        <div className="v4p-board-panel__section-title">Contrato vinculado</div>
        <div className="v4p-board-panel__contract">
          <span className="v4p-mono">{board.campanha ? getContractId(board) : 'Sem contrato'}</span>
          <strong>{board.campanha ? 'Contrato ativo' : 'Inventario disponivel'}</strong>
        </div>
      </section>

      <section className="v4p-board-panel__section">
        <div className="v4p-board-panel__section-title">Dados da placa</div>
        <DetailRow label="Regiao" value={board.regiao} />
        <DetailRow label="Categoria" value={board.categoria} />
        <DetailRow label="Visibilidade" value={board.visibilidade} />
        <DetailRow label="Risco" value={riskMeta.label} valueColor={riskMeta.color} />
      </section>

      <section className="v4p-board-panel__section">
        <div className="v4p-board-panel__availability">
          <div>
            <span>Ocupacao</span>
            <strong>{occupancyPct}%</strong>
          </div>
          <div className="v4p-board-panel__bar">
            <i style={{ '--v4p-progress': `${occupancyPct}%` }} />
          </div>
        </div>
        <p className="v4p-board-panel__note">{board.statusDetalhe}</p>
      </section>

      <section className="v4p-board-panel__section">
        <div className="v4p-board-panel__section-title">Atividade recente</div>
        <div className="v4p-board-panel__activity">
          {recentActivity.length === 0 && (
            <div>
              <i data-type="info" />
              <span>Nenhuma atividade recente retornada pela API V4.</span>
              <time>--</time>
            </div>
          )}
          {recentActivity.map((activity) => (
            <div key={`${activity.description ?? activity.label}-${activity.date ?? activity.tempo}`}>
              <i data-type={activity.tipo ?? activity.type ?? 'info'} />
              <span>{activity.description ?? activity.label}</span>
              <time>{activity.date ?? activity.tempo ?? '--'}</time>
            </div>
          ))}
        </div>
      </section>

      <section className="v4p-board-panel__section">
        <div className="v4p-board-panel__section-title">Recomendacao</div>
        <p className="v4p-board-panel__recommendation">{board.recomendacao}</p>
      </section>

      <button type="button" className="v4p-board-panel__primary">
        {getActionLabel(board)}
      </button>
    </aside>
  );
}

export default memo(BoardDetailsPanel);
