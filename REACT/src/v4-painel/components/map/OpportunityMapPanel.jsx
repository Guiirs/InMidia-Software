import { memo } from 'react';
import './OpportunityMapPanel.css';

const isExpansion = (item) => item.tipo?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith('expans');

function OpportunityMapPanel({ opportunities = [] }) {
  const idle = opportunities.filter((item) => !isExpansion(item));
  const expansion = opportunities.filter(isExpansion);

  return (
    <section className="v4p-opp-panel">
      <header className="v4p-opp-panel__header">
        <div>
          <span>Mapa de oportunidade</span>
          <h2>Potencial comercial por regiao</h2>
          <p>{opportunities.length} leituras derivadas de placas disponiveis e baixa ocupacao.</p>
        </div>
        <strong>{idle.length + expansion.length}</strong>
      </header>

      <div className="v4p-opp-panel__summary">
        <article>
          <span>Posicoes ociosas</span>
          <strong>{idle.length}</strong>
        </article>
        <article>
          <span>Baixa ocupacao</span>
          <strong>{expansion.length}</strong>
        </article>
        <article>
          <span>Fonte</span>
          <strong>V4</strong>
        </article>
      </div>

      <div className="v4p-opp-panel__list">
        {opportunities.map((opp) => (
          <article key={opp.id} className="v4p-opp-panel__item" data-kind={isExpansion(opp) ? 'expansao' : 'ociosa'}>
            <div>
              <span>{opp.tipo}</span>
              <strong>{opp.label}</strong>
              <p>{opp.regiao}</p>
            </div>
            <em>{opp.potencial}</em>
            <button type="button" disabled>Priorizar</button>
          </article>
        ))}
        {opportunities.length === 0 && (
          <article className="v4p-opp-panel__item">
            <div>
              <span>sem oportunidade</span>
              <strong>Nenhuma frente comercial derivada.</strong>
              <p>As regioes retornadas nao possuem placas disponiveis ou baixa ocupacao.</p>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

export default memo(OpportunityMapPanel);
