import { memo, useMemo } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';
import { getPriorityMeta } from '../../foundation/priorities.js';
import './RegionManager.css';

function RegionManager({ regions = [] }) {
  const summary = useMemo(() => {
    const totalBoards = regions.reduce((sum, region) => sum + region.placas, 0);
    const avgOccupancy = regions.length
      ? Math.round(regions.reduce((sum, region) => sum + region.ocupacao, 0) / regions.length)
      : 0;

    return { totalBoards, avgOccupancy };
  }, [regions]);

  return (
    <section className="v4p-region-manager" aria-labelledby="region-manager-title">
      <header className="v4p-region-manager__header">
        <div>
          <span>Gestao territorial</span>
          <h2 id="region-manager-title">Regioes operacionais</h2>
          <p>Visualize cobertura e prioridade a partir das placas reais da API V4.</p>
        </div>
      </header>

      <div className="v4p-region-manager__summary" aria-label="Resumo das regioes operacionais">
        <article>
          <span>Regioes</span>
          <strong>{regions.length}</strong>
        </article>
        <article>
          <span>Placas</span>
          <strong>{summary.totalBoards}</strong>
        </article>
        <article>
          <span>Ocupacao media</span>
          <strong>{summary.avgOccupancy}%</strong>
        </article>
      </div>

      <div className="v4p-region-manager__list">
        {regions.map((region) => {
          const stateMeta = getStateMeta(region.estado);
          const priorityMeta = getPriorityMeta(region.prioridade);

          return (
            <article className="v4p-region-manager__row" key={region.id} style={{ '--v4p-region-color': region.cor }}>
              <div className="v4p-region-manager__identity">
                <span className="v4p-region-manager__swatch" />
                <div>
                  <strong>{region.nome}</strong>
                  <p>{region.cidade}, {region.uf} - {region.responsavel}</p>
                </div>
              </div>

              <div className="v4p-region-manager__status">
                <span style={{ color: stateMeta.color }}>
                  <i style={{ background: stateMeta.color }} />
                  {stateMeta.label}
                </span>
                <em>{region.placas} placas</em>
              </div>

              <div className="v4p-region-manager__progress">
                <div>
                  <span>Ocupacao</span>
                  <strong>{region.ocupacao}% / meta {region.metaOcupacao}%</strong>
                </div>
                <b><i style={{ width: `${region.ocupacao}%`, background: stateMeta.color }} /></b>
              </div>

              <div className="v4p-region-manager__priority" style={{ color: priorityMeta.color }}>
                {priorityMeta.label}
              </div>

              <p className="v4p-region-manager__note">{region.observacao}</p>
            </article>
          );
        })}
      </div>

      <div className="v4p-region-manager__source-note">
        Regioes derivadas de placas reais. Criacao e edicao territorial exigem endpoint dedicado.
      </div>
    </section>
  );
}

export default memo(RegionManager);
