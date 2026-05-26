// src/pages/PlacaDetailsPage/PlacaDetailsPage.jsx
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPlacaById } from '../../services';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import Spinner from '../../components/Spinner/Spinner';
import { getImageUrl } from '../../utils/helpers';
import PlacaDetailsInfo from '../../components/PlacaDetailsInfo/PlacaDetailsInfo';
import PlacaMap from '../../components/PlacaMap/PlacaMap';
import PlacaAluguelHistory from '../../components/PlacaAluguelHistory/PlacaAluguelHistory';
import EntityActivityTimeline from '../../components/EntityActivityTimeline/EntityActivityTimeline';
import './PlacaDetailsPage.css';

const placaQueryKey = (id) => ['placa', id];

function parseCoordinatePair(value) {
  if (typeof value !== 'string' || !value.includes(',')) return null;
  const [rawLat, rawLng] = value.split(',').map((part) => part.trim());
  if (rawLat === '' || rawLng === '') return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function PlacaDetailsPage() {
  const { id: placaId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  useEffect(() => {
    if (!placaId || String(placaId).trim() === '' || String(placaId) === 'undefined') {
      showToast('ID da placa invalido.', 'error');
      navigate('/placas', { replace: true });
    }
  }, [placaId, navigate, showToast]);

  const {
    data: placa,
    isLoading: isLoadingPlaca,
    isError: isErrorPlaca,
    error: errorPlaca,
  } = useQuery({
    queryKey: placaQueryKey(placaId),
    queryFn: () => fetchPlacaById(placaId),
    enabled: !!placaId,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showToast(err.message || 'Erro ao carregar detalhes da placa.', 'error');
      if (err.message.includes('nao encontrada') || err.message.includes('não encontrada')) {
        navigate('/placas', { replace: true });
      }
    },
  });

  if (isLoadingPlaca) {
    return <Spinner message="A carregar detalhes da placa..." />;
  }

  if (isErrorPlaca) {
    return <div className="placa-details-page"><p className="error-message">Erro ao carregar placa: {errorPlaca.message}</p></div>;
  }

  if (!placa) {
    return <div className="placa-details-page"><p>Placa nao encontrada.</p></div>;
  }

  let statusText = 'Disponivel';
  let statusClass = 'placa-details-page__status--disponivel';

  if (placa.aluguel_ativo) {
    if (placa.aluguel_futuro) {
      statusText = 'Reservada';
      statusClass = 'placa-details-page__status--reservada';
    } else {
      statusText = 'Contratada';
      statusClass = 'placa-details-page__status--indisponivel';
    }
  } else if (!placa.disponivel) {
    statusText = 'Indisponivel';
    statusClass = 'placa-details-page__status--manutencao';
  }

  const placeholderUrl = '/assets/img/placeholder.png';
  const imageUrl = getImageUrl(placa.imagem, placeholderUrl);
  const mapPosition = parseCoordinatePair(placa.coordenadas);

  return (
    <>
      <div className="placa-details-page">
        <PlacaDetailsInfo
          placa={placa}
          imageUrl={imageUrl}
          placeholderUrl={placeholderUrl}
          statusText={statusText}
          statusClass={statusClass}
        />

        <div id="details-map" className="placa-details-page__map-container">
          <PlacaMap
            mapPosition={mapPosition}
            numeroPlaca={placa.numero_placa}
          />
        </div>
      </div>

      <PlacaAluguelHistory placaId={placaId} />

      <EntityActivityTimeline
        entityType="placa"
        entityId={placaId}
        title="Historico da placa"
      />
    </>
  );
}

export default PlacaDetailsPage;
