// Mapeamento de codigos de erro da API (ver error-handler.middleware.ts) para
// mensagens amigaveis exibidas na aba Operacoes. As mensagens tecnicas do
// backend (ex.: "Placa da operacao nao encontrada para a empresa.") ficam
// apenas no log/console — o usuario final ve sempre uma das mensagens abaixo.

export const OPERATION_DEFAULT_ERROR_MESSAGE = 'Não foi possível concluir a ação. Tente novamente em instantes.';

export const OPERATION_ERROR_MESSAGES = {
  OPERATION_BOARD_REQUIRED: {
    message: 'Selecione uma placa para criar a operação.',
    field: 'plateId',
    fieldMessage: 'Selecione uma placa.',
  },
  OPERATION_BOARD_INVALID: {
    message: 'A placa informada é inválida. Selecione uma placa cadastrada no inventário.',
    field: 'plateId',
    fieldMessage: 'Placa inválida.',
  },
  OPERATION_BOARD_NOT_FOUND: {
    message: 'Não encontramos a placa selecionada. Atualize a lista e selecione novamente.',
    field: 'plateId',
    fieldMessage: 'Placa não encontrada.',
  },
  OPERATION_TYPE_REQUIRED: {
    message: 'Selecione o tipo de operação.',
    field: 'operationType',
    fieldMessage: 'Selecione o tipo de operação.',
  },
  OPERATION_TYPE_INVALID: {
    message: 'O tipo de operação selecionado é inválido.',
    field: 'operationType',
    fieldMessage: 'Tipo de operação inválido.',
  },
  OPERATION_CONFLICT_ACTIVE_TASK: {
    message: 'Essa placa já possui uma operação ativa. Conclua ou cancele a operação atual antes de criar uma nova.',
    field: 'plateId',
    fieldMessage: 'Já existe uma operação ativa para esta placa.',
  },
  PLATE_OPERATION_ALREADY_OPEN: {
    message: 'Esta placa já possui uma operação em aberto.',
    field: 'plateId',
    fieldMessage: 'Selecione outra placa.',
  },
  OPERATION_FINAL_REPORT_REQUIRED: {
    message: 'Informe o relatório final da manutenção. Descreva o que foi feito antes de concluir.',
    field: 'finalReport',
    fieldMessage: 'Relatório final é obrigatório.',
  },
  OPERATION_NOT_FOUND: {
    message: 'Operação não encontrada. Ela pode ter sido removida ou não estar mais disponível.',
  },
  OPERATION_INVALID_STATUS: {
    message: 'Esta ação não é permitida no status atual da operação. Atualize a lista e tente novamente.',
  },
  OPERATION_TEAM_NAME_CONFLICT: {
    message: 'Já existe uma equipe cadastrada com esse nome.',
    field: 'name',
    fieldMessage: 'Já existe uma equipe com esse nome.',
  },
  OPERATION_TEAM_NAME_REQUIRED: {
    message: 'Informe o nome da equipe.',
    field: 'name',
    fieldMessage: 'Informe o nome da equipe.',
  },
  OPERATION_TEAM_NOT_FOUND: {
    message: 'Equipe operacional não encontrada. Atualize a lista e tente novamente.',
  },
  OPERATION_TEAM_INVALID: {
    message: 'A equipe selecionada não está disponível. Selecione outra equipe e tente novamente.',
    field: 'teamId',
    fieldMessage: 'Equipe inválida ou indisponível.',
  },
};

/**
 * Extrai o codigo de erro estruturado de um erro lancado pelo apiClient/v4ServiceUtils,
 * cobrindo tanto o formato novo ({ error: { code, field } }) quanto o flat legado ({ code }).
 */
function extractApiError(error) {
  const data = error?.response?.data;
  return {
    code: error?.code ?? data?.error?.code ?? data?.code ?? null,
    field: error?.field ?? data?.error?.field ?? data?.field ?? null,
    requestId: error?.requestId ?? data?.requestId ?? null,
  };
}

/**
 * Traduz um erro de API da aba Operacoes para uma apresentacao amigavel:
 * - message: texto principal a exibir no corpo do modal/alerta
 * - field: nome do campo do formulario a destacar (ou null)
 * - fieldMessage: texto curto para erro inline no campo (ou null)
 * - code/requestId: mantidos apenas para contexto de suporte/log
 */
export function getOperationErrorPresentation(error) {
  const { code, field: apiField, requestId } = extractApiError(error);
  const entry = code ? OPERATION_ERROR_MESSAGES[code] : null;

  return {
    code: code ?? null,
    requestId,
    message: entry?.message ?? OPERATION_DEFAULT_ERROR_MESSAGE,
    field: entry?.field ?? apiField ?? null,
    fieldMessage: entry?.fieldMessage ?? null,
  };
}
