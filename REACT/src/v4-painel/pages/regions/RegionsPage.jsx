import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import { RegionManagerPanel } from '../../components/map/index.js';
import './RegionsPage.css';

function RegionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const canRead = permissions.includes('regions.read') || permissions.includes('admin.access');

  const handleGoToMap = useCallback(() => navigate('/mapa'), [navigate]);

  if (!canRead) {
    return (
      <div className="v4p-regions-page v4p-regions-page--forbidden" role="status">
        <span className="material-symbols-rounded" aria-hidden="true">lock</span>
        <p>Você não tem permissão para visualizar regiões.</p>
        <span>Entre em contato com o administrador para solicitar acesso.</span>
      </div>
    );
  }

  return (
    <div className="v4p-regions-page">
      <header className="v4p-regions-hero">
        <div className="v4p-regions-hero__identity">
          <span className="v4p-regions-hero__eyebrow">Gestão territorial</span>
          <h1 className="v4p-regions-hero__title">Regiões</h1>
          <p className="v4p-regions-hero__subtitle">
            Gerencie territórios, placas, ocupação e operação regional da sua mídia exterior.
          </p>
        </div>

        <div className="v4p-regions-hero__actions">
          <button
            type="button"
            className="v4p-regions-hero__btn-map"
            onClick={handleGoToMap}
            aria-label="Ir para visualização do mapa"
          >
            <span className="material-symbols-rounded" aria-hidden="true">map</span>
            Ver mapa
          </button>
        </div>
      </header>

      <div className="v4p-regions-body">
        <RegionManagerPanel />
      </div>
    </div>
  );
}

export default memo(RegionsPage);
