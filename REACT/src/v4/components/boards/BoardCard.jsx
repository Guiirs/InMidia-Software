import BoardOccupancyIndicator from './BoardOccupancyIndicator';
import BoardStatusBadge from './BoardStatusBadge';

const statusAlertMap = {
  reservada: 'Reserva ativa para proximo ciclo.',
  indisponivel: 'Operacao bloqueada para comercializacao.',
  vencendo: 'Contrato em janela critica de renovacao.',
  pendente: 'Pendencia documental exige tratativa.'
};

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return 'Nao informado';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(Number(value));
}

function getStatusAlertText(status, customAlert) {
  if (customAlert) {
    return customAlert;
  }

  return statusAlertMap[status] || null;
}

export default function BoardCard({ board, compact = false, className = '' }) {
  const {
    name,
    code,
    photoUrl,
    imageUrl,
    location,
    city,
    region,
    status,
    occupancy,
    availabilityLabel,
    currentClient,
    clientName,
    periodLabel,
    referencePrice,
    priceLabel,
    actionLabels = [],
    actions = [],
    alertText,
    alert
  } = board;

  const normalizedActions = actionLabels.length > 0 ? actionLabels : actions;
  const alertMessage = getStatusAlertText(status, alertText || alert);

  const rootClass = [
    'v4-board-card',
    compact ? 'v4-board-card--compact' : '',
    alertMessage ? 'v4-board-card--with-alert' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <article className={rootClass}>
      <header className="v4-board-card__media">
        <img className="v4-board-card__photo" src={photoUrl || imageUrl} alt={`Imagem da placa ${code}`} loading="lazy" />
        <div className="v4-board-card__media-overlay" />
        <div className="v4-board-card__status-wrap">
          <BoardStatusBadge status={status} />
        </div>
      </header>

      <div className="v4-board-card__body">
        <div className="v4-board-card__identity">
          <p className="v4-board-card__eyebrow">Placa operacional</p>
          <h3 className="v4-board-card__title">{name}</h3>
          <p className="v4-board-card__code">Codigo {code}</p>
        </div>

        <div className="v4-board-card__location-block">
          <p className="v4-board-card__location">{location}</p>
          <p className="v4-board-card__geo">{city} | {region}</p>
        </div>

        {!compact && (
          <BoardOccupancyIndicator occupancy={occupancy} availabilityLabel={availabilityLabel} />
        )}

        <div className="v4-board-card__contract">
          <p className="v4-board-card__contract-label">Cliente atual</p>
          <p className="v4-board-card__contract-value">{currentClient || clientName || 'Sem cliente ativo'}</p>
          <p className="v4-board-card__contract-period">{periodLabel || 'Sem periodo contratado'}</p>
        </div>

        <div className="v4-board-card__bottom">
          <div className="v4-board-card__price">
            <span className="v4-board-card__price-label">Valor de referencia</span>
            <strong className="v4-board-card__price-value">{priceLabel || formatCurrency(referencePrice)}</strong>
          </div>

          <div className="v4-board-card__actions" aria-label="Acoes rapidas visuais">
            {normalizedActions.map((label) => (
              <button key={label} className="v4-board-card__action" type="button">{label}</button>
            ))}
          </div>
        </div>

        {alertMessage && (
          <div className="v4-board-card__alert" role="status">
            {alertMessage}
          </div>
        )}
      </div>
    </article>
  );
}
