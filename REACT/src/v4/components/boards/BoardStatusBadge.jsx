const statusConfig = {
  disponivel: { label: 'Disponivel', tone: 'disponivel' },
  ocupada: { label: 'Ocupada', tone: 'ocupada' },
  reservada: { label: 'Reservada', tone: 'reservada' },
  manutencao: { label: 'Manutencao', tone: 'manutencao' },
  indisponivel: { label: 'Indisponivel', tone: 'indisponivel' },
  vencendo: { label: 'Vencendo', tone: 'vencendo' },
  pendente: { label: 'Pendente', tone: 'pendente' }
};

export default function BoardStatusBadge({ status = 'disponivel', className = '' }) {
  const config = statusConfig[status] || { label: status, tone: 'neutro' };

  const rootClass = [
    'v4-board-status-badge',
    `v4-board-status-badge--${config.tone}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={rootClass}>
      {config.label}
    </span>
  );
}
