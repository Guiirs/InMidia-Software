import { SearchInput, StatusBadge } from '../components';

export default function ShellTopbar({
  title,
  context,
  syncStatusLabel = 'Sincronização estável',
  syncModeLabel = 'SSE ativo',
  userName = 'Operador Demo',
  companyName = 'Empresa Demo',
  searchValue,
  onSearchChange,
  onSearchClear
}) {
  return (
    <header className="v4-shell-topbar" aria-label="Topbar shell v4">
      <div className="v4-shell-topbar__title-block">
        <p className="v4-shell-topbar__eyebrow">Contexto operacional</p>
        <h1 className="v4-shell-topbar__title">{title}</h1>
        <p className="v4-shell-topbar__context">{context}</p>
      </div>

      <div className="v4-shell-topbar__search-block">
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          onClear={onSearchClear}
          placeholder="Buscar placa, cliente ou contrato"
          className="v4-shell-topbar__search"
        />
      </div>

      <div className="v4-shell-topbar__meta">
        <div className="v4-shell-topbar__sync">
          <StatusBadge status="success" label={syncStatusLabel} />
          <StatusBadge status="info" label={syncModeLabel} />
        </div>

        <div className="v4-shell-topbar__identity">
          <p className="v4-shell-topbar__user">{userName}</p>
          <p className="v4-shell-topbar__company">{companyName}</p>
        </div>
      </div>
    </header>
  );
}
