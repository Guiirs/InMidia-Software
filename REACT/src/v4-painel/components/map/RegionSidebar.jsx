import { memo } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';
import './RegionSidebar.css';

const isExpansion = (item) => item.tipo?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith('expans');

function fmtMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function RegionRankRow({ region, selected, onSelect, index }) {
  const meta = getStateMeta(region.estado);
  const pct = Math.round(region.ocupacao * 100);

  return (
    <button
      type="button"
      className={`v4p-region-row ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect?.(region.id)}
      style={{ '--v4p-region-color': meta.color }}
    >
      <span className="v4p-region-row__rank">{index + 1}</span>
      <span className="v4p-region-row__main">
        <span>
          <strong>{region.sigla}</strong>
          <em>{region.label}</em>
        </span>
        <i><b style={{ width: `${pct}%` }} /></i>
      </span>
      <span className="v4p-region-row__metric">
        <strong>{pct}%</strong>
        <em>{fmtMoney(region.receita)}</em>
      </span>
    </button>
  );
}

function RegionSidebar({ selectedRegionId, onRegionSelect, regions = [], opportunities = [] }) {
  const sortedRegions = [...regions].sort((a, b) => b.ocupacao - a.ocupacao || b.placas - a.placas);
  const totalRevenue = sortedRegions.reduce((sum, region) => sum + Number(region.receita ?? 0), 0);
  const topRegion = sortedRegions[0] ?? null;

  return (
    <div className="v4p-region-sidebar">
      <section className="v4p-region-card v4p-region-card--summary">
        <span>Regioes monitoradas</span>
        <strong>{sortedRegions.length}</strong>
        <p>
          {topRegion
            ? `${topRegion.sigla} lidera ocupacao com ${Math.round(topRegion.ocupacao * 100)}% e ${fmtMoney(totalRevenue)}/mes em leitura operacional.`
            : 'Nenhuma regiao retornada pela API V4.'}
        </p>
      </section>

      <section className="v4p-region-card">
        <header className="v4p-region-card__header">
          <div>
            <strong>Ranking regional</strong>
            <span>Ocupacao e receita estimada</span>
          </div>
        </header>
        <div className="v4p-region-list">
          {sortedRegions.map((region, index) => (
            <RegionRankRow
              key={region.id}
              region={region}
              index={index}
              selected={selectedRegionId === region.id}
              onSelect={onRegionSelect}
            />
          ))}
          {sortedRegions.length === 0 && <div className="v4p-region-opps">Sem regioes reais.</div>}
        </div>
      </section>

      <section className="v4p-region-card">
        <header className="v4p-region-card__header">
          <div>
            <strong>Oportunidades</strong>
            <span>{opportunities.length} frentes comerciais derivadas</span>
          </div>
        </header>
        <div className="v4p-region-opps">
          {opportunities.slice(0, 4).map((opp) => (
            <article key={opp.id} data-kind={isExpansion(opp) ? 'expansao' : 'ociosa'}>
              <span>{opp.tipo}</span>
              <strong>{opp.label}</strong>
              <em>{opp.regiao}</em>
              <b>{opp.potencial}</b>
            </article>
          ))}
          {opportunities.length === 0 && <div>Sem oportunidades derivadas no momento.</div>}
        </div>
      </section>
    </div>
  );
}

export default memo(RegionSidebar);
