import { memo } from 'react';

const TYPE_META = {
  campaign_activated: { icon: 'campaign',      color: 'var(--v4p-success)', label: 'Campanha ativada'    },
  contract_renewed:   { icon: 'autorenew',      color: 'var(--v4p-accent)',  label: 'Contrato renovado'  },
  inspection:         { icon: 'search',         color: 'var(--v4p-info)',    label: 'Vistoria realizada' },
  board_released:     { icon: 'lock_open',      color: 'var(--v4p-warning)', label: 'Placa liberada'     },
  registry_update:    { icon: 'edit_note',      color: 'var(--v4p-text-3)',  label: 'Ajuste cadastral'   },
  status_change:      { icon: 'swap_horiz',     color: 'var(--v4p-danger)',  label: 'Alteração de status'},
};

function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function BoardActivityHistory({ history }) {
  if (!history?.length) {
    return (
      <section className="v4p-activity">
        <header className="v4p-activity__header">
          <span className="material-symbols-rounded v4p-activity__header-icon">history</span>
          <div><h3>Histórico de atividades</h3><p>Sem registros</p></div>
        </header>
        <div className="v4p-activity__empty">Nenhuma atividade registrada.</div>
      </section>
    );
  }

  return (
    <section className="v4p-activity">
      <header className="v4p-activity__header">
        <span className="material-symbols-rounded v4p-activity__header-icon" aria-hidden="true">history</span>
        <div>
          <h3>Histórico de atividades</h3>
          <p>{history.length} eventos registrados</p>
        </div>
      </header>

      <div className="v4p-activity__timeline">
        {history.map((item, i) => {
          const meta = TYPE_META[item.type] ?? TYPE_META.registry_update;
          const isLast = i === history.length - 1;
          return (
            <div key={`${item.date}-${i}`} className="v4p-activity__item" data-last={isLast}>
              <div className="v4p-activity__dot" style={{ '--v4p-dot-color': meta.color }}>
                <span className="material-symbols-rounded" style={{ fontSize: 11, color: meta.color }} aria-hidden="true">
                  {meta.icon}
                </span>
              </div>
              {!isLast && <div className="v4p-activity__line" />}
              <div className="v4p-activity__content">
                <div className="v4p-activity__desc">{item.description}</div>
                <div className="v4p-activity__byline">
                  <span className="v4p-activity__user">{item.user}</span>
                  <time className="v4p-activity__date">{fmtDate(item.date)}</time>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default memo(BoardActivityHistory);
