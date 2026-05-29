// Fonte única de verdade para status de placas e severidade de alertas.
// Nenhum enum de backend deve aparecer diretamente no JSX — usar estas funções.

export const PLACA_STATUS = {
  disponivel: { label: 'Disponível',    tone: 'success'  },
  ocupada:    { label: 'Ocupada',       tone: 'danger'   },
  reservada:  { label: 'Reservada',     tone: 'info'     },
  manutencao: { label: 'Manutenção',    tone: 'warning'  },
  erro:       { label: 'Indisponível',  tone: 'neutral'  },
};

/**
 * Deriva um status canônico a partir de qualquer modelo de placa (legado ou temporalStatus).
 * @param {object|null} placa
 * @returns {'disponivel'|'ocupada'|'reservada'|'manutencao'|'erro'}
 */
export function resolvePlacaStatus(placa) {
  if (!placa) return 'erro';

  const cs = placa.temporalStatus ?? placa.commercialStatus ?? placa.statusComercial;

  if (cs === 'CONTRACTED_ACTIVE' || cs === 'OCCUPIED') return 'ocupada';
  if (cs === 'RESERVED' || cs === 'FUTURE_RESERVED')   return 'reservada';
  if (cs === 'MAINTENANCE')                            return 'manutencao';

  // Modelo legado (booleans)
  const { aluguel_ativo, aluguel_futuro, cliente_nome } = placa;
  if (aluguel_ativo && cliente_nome) {
    return aluguel_futuro ? 'reservada' : 'ocupada';
  }

  const disponivel = placa.disponivel ?? placa.ativa ?? true;
  return disponivel ? 'disponivel' : 'manutencao';
}

export const SEVERIDADE = {
  critical: { label: 'Crítico',      tone: 'danger'  },
  warning:  { label: 'Atenção',      tone: 'warning' },
  info:     { label: 'Informativo',  tone: 'info'    },
};
