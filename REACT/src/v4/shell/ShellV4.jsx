import { useMemo, useState } from 'react';

import { PageShell } from '../components';

import ShellSidebar from './ShellSidebar';
import ShellTopbar from './ShellTopbar';
import { shellNavV4 } from './shellNav';

import './ShellV4.css';

function findFirstNavItem(navGroups) {
  for (const group of navGroups) {
    if (group.items && group.items.length > 0) {
      return group.items[0];
    }
  }

  return null;
}

export default function ShellV4({
  navGroups = shellNavV4,
  initialActiveItemId = 'dashboard',
  activeItemId = null,
  onActiveItemChange = null,
  userName = 'Operador Demo',
  companyName = 'Empresa Demo',
  companyCode = 'TENANT-DEMO',
  topbarTitle = null,
  topbarContext = null,
  children = null
}) {
  const [internalActiveItemId, setInternalActiveItemId] = useState(initialActiveItemId);
  const [searchValue, setSearchValue] = useState('');

  const resolvedActiveItemId = activeItemId ?? internalActiveItemId;

  const activeItem = useMemo(() => {
    for (const group of navGroups) {
      const found = group.items.find((item) => item.id === resolvedActiveItemId);
      if (found) {
        return found;
      }
    }

    return findFirstNavItem(navGroups);
  }, [resolvedActiveItemId, navGroups]);

  const handleSelectItem = (item) => {
    if (!item?.id) {
      return;
    }

    if (activeItemId == null) {
      setInternalActiveItemId(item.id);
    }

    onActiveItemChange && onActiveItemChange(item.id, item);
  };

  const shellTitle = topbarTitle || (activeItem ? activeItem.label : 'Shell v4');
  const shellContext = topbarContext || (activeItem
    ? activeItem.context
    : 'Camada de layout isolada para futura ativação com feature flag.');

  return (
    <PageShell className="v4-shell-v4" fullHeight>
      <div className="v4-shell-v4__layout">
        <ShellSidebar
          navGroups={navGroups}
          activeItemId={activeItem ? activeItem.id : null}
          onSelect={handleSelectItem}
          companyName={companyName}
          companyCode={companyCode}
        />

        <main className="v4-shell-v4__main" aria-label="Área principal shell v4">
          <ShellTopbar
            title={shellTitle}
            context={shellContext}
            syncStatusLabel="Sincronização estável"
            syncModeLabel="SSE ativo"
            userName={userName}
            companyName={companyName}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onSearchClear={() => setSearchValue('')}
          />

          <section className="v4-shell-v4__surface" aria-label="Superficie de conteudo isolada">
            <div className="v4-shell-v4__surface-head">
              <h2 className="v4-shell-v4__surface-title">Área de composição visual</h2>
              <p className="v4-shell-v4__surface-subtitle">Preparada para acoplar páginas v4 sem alterar o fluxo oficial.</p>
            </div>

            <div className="v4-shell-v4__context-grid">
              <article className="v4-shell-v4__context-card">
                <p className="v4-shell-v4__context-label">Rota futura</p>
                <p className="v4-shell-v4__context-value">{activeItem ? activeItem.futureRoute : 'N/A'}</p>
              </article>

              <article className="v4-shell-v4__context-card">
                <p className="v4-shell-v4__context-label">Chave de permissão futura</p>
                <p className="v4-shell-v4__context-value">{activeItem ? activeItem.integrationKey : 'N/A'}</p>
              </article>

              <article className="v4-shell-v4__context-card">
                <p className="v4-shell-v4__context-label">Busca visual</p>
                <p className="v4-shell-v4__context-value">{searchValue || 'Sem termo digitado'}</p>
              </article>
            </div>

            {children ? (
              <div className="v4-shell-v4__content-slot">
                {children}
              </div>
            ) : (
              <div className="v4-shell-v4__placeholder">
                <p className="v4-shell-v4__placeholder-title">Sem integração ativa</p>
                <p className="v4-shell-v4__placeholder-text">
                  Este shell permanece isolado. A conexão com rotas reais, permissão e sincronização será feita em etapa futura controlada.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </PageShell>
  );
}
