import { memo } from 'react';

/**
 * Badge que indica dados desatualizados. Exibir quando os dados
 * não foram atualizados recentemente e o usuário deve saber disso.
 */
function V4StaleBadge({ since, label = 'Dados desatualizados' }) {
  return (
    <span className="v4p-stale-badge" title={since ? `Última atualização: ${since}` : undefined}>
      <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 11 }}>
        schedule
      </span>
      {since ? `${label} · ${since}` : label}
    </span>
  );
}

export default memo(V4StaleBadge);
