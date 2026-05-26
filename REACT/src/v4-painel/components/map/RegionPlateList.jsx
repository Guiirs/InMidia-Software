import { memo } from 'react';

const STATUS_LABEL = {
  available: 'Disponível',
  occupied: 'Ocupado',
  reserved: 'Reservado',
  maintenance: 'Manutenção',
  critical: 'Crítico',
};

function RegionPlateList({ plates, canManage, onDetach, detachLoading }) {
  if (!plates.length) {
    return (
      <div className="v4p-region-plates__empty" role="status">
        <span className="material-symbols-rounded" aria-hidden="true">image_not_supported</span>
        <p>Nenhuma placa vinculada a esta região.</p>
      </div>
    );
  }

  return (
    <div className="v4p-region-plates">
      <header className="v4p-region-plates__header">
        <span className="material-symbols-rounded" aria-hidden="true">view_module</span>
        <h4>Placas vinculadas</h4>
        <span className="v4p-region-plates__count">{plates.length}</span>
      </header>
      <ul className="v4p-region-plates__list" role="list">
        {plates.map((plate) => {
          const id = plate.id ?? plate.plateId ?? plate.codigo;
          const code = plate.code ?? plate.codigo ?? plate.numero ?? id;
          const address = plate.address ?? plate.localizacao ?? plate.endereco ?? '';
          const status = plate.status ?? 'available';
          const lot = plate.regionalLot ?? plate.loteRegional ?? null;

          return (
            <li key={id} className="v4p-region-plates__item">
              <span
                className={`v4p-region-plates__dot v4p-region-plates__dot--${status}`}
                aria-hidden="true"
              />
              <div className="v4p-region-plates__info">
                <div className="v4p-region-plates__top-row">
                  <strong className="v4p-region-plates__code">{code}</strong>
                  <span className={`v4p-region-plates__status-chip v4p-region-plates__status-chip--${status}`}>
                    {STATUS_LABEL[status] ?? status}
                  </span>
                  {lot && (
                    <span className="v4p-region-plates__lot">{lot}</span>
                  )}
                </div>
                {address && (
                  <span className="v4p-region-plates__address">
                    <span className="material-symbols-rounded" aria-hidden="true">location_on</span>
                    {address}
                  </span>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  className="v4p-region-plates__detach"
                  onClick={() => onDetach?.(id)}
                  disabled={detachLoading}
                  aria-label={`Desvincular placa ${code}`}
                >
                  <span className="material-symbols-rounded" aria-hidden="true">link_off</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default memo(RegionPlateList);
