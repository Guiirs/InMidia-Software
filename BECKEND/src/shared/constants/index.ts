/**
 * Constantes Globais da API
 * Define todos os valores constantes usados em toda a aplicação
 */

// ============================================
// STATUS E ESTADOS
// ============================================

export const STATUS = {
  // Status de Aluguel
  ALUGUEL: {
    ATIVO: 'ativo',
    CONCLUIDO: 'concluido',
    CANCELADO: 'cancelado',
    PENDENTE: 'pendente'
  },
  
  // Status de Contrato
  CONTRATO: {
    RASCUNHO: 'rascunho',
    ATIVO: 'ativo',
    CONCLUIDO: 'concluido',
    CANCELADO: 'cancelado',
    AGUARDANDO_ASSINATURA: 'aguardando_assinatura'
  },
  
  // Status de Proposta Interna
  PI: {
    RASCUNHO: 'rascunho',
    ENVIADA: 'enviada',
    APROVADA: 'aprovada',
    REJEITADA: 'rejeitada',
    CONVERTIDA: 'convertida'
  },
  
  // Status de Placa
  PLACA: {
    DISPONIVEL: 'disponivel',
    RESERVADA: 'reservada',
    ALUGADA: 'alugada',
    MANUTENCAO: 'manutencao',
    INATIVA: 'inativa'
  }
} as const;

// ============================================
// ROLES E PERMISSÕES
// ============================================

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
  MANAGER: 'manager'
} as const;

export const PERMISSIONS = {
  // Clientes
  CLIENTE_CREATE: 'cliente:create',
  CLIENTE_READ: 'cliente:read',
  CLIENTE_UPDATE: 'cliente:update',
  CLIENTE_DELETE: 'cliente:delete',
  
  // Placas
  PLACA_CREATE: 'placa:create',
  PLACA_READ: 'placa:read',
  PLACA_UPDATE: 'placa:update',
  PLACA_DELETE: 'placa:delete',
  
  // Contratos
  CONTRATO_CREATE: 'contrato:create',
  CONTRATO_READ: 'contrato:read',
  CONTRATO_UPDATE: 'contrato:update',
  CONTRATO_DELETE: 'contrato:delete',
  CONTRATO_GENERATE_PDF: 'contrato:generate_pdf',
  
  // Aluguéis
  ALUGUEL_CREATE: 'aluguel:create',
  ALUGUEL_READ: 'aluguel:read',
  ALUGUEL_UPDATE: 'aluguel:update',
  ALUGUEL_DELETE: 'aluguel:delete',
  
  // Relatórios
  RELATORIO_READ: 'relatorio:read',
  RELATORIO_EXPORT: 'relatorio:export',
  
  // Administração
  USER_MANAGE: 'user:manage',
  EMPRESA_MANAGE: 'empresa:manage',
  SETTINGS_MANAGE: 'settings:manage'
} as const;

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.MANAGER]: [
    PERMISSIONS.CLIENTE_CREATE,
    PERMISSIONS.CLIENTE_READ,
    PERMISSIONS.CLIENTE_UPDATE,
    PERMISSIONS.PLACA_CREATE,
    PERMISSIONS.PLACA_READ,
    PERMISSIONS.PLACA_UPDATE,
    PERMISSIONS.CONTRATO_CREATE,
    PERMISSIONS.CONTRATO_READ,
    PERMISSIONS.CONTRATO_UPDATE,
    PERMISSIONS.CONTRATO_GENERATE_PDF,
    PERMISSIONS.ALUGUEL_CREATE,
    PERMISSIONS.ALUGUEL_READ,
    PERMISSIONS.ALUGUEL_UPDATE,
    PERMISSIONS.RELATORIO_READ,
    PERMISSIONS.RELATORIO_EXPORT
  ],
  [ROLES.USER]: [
    PERMISSIONS.CLIENTE_READ,
    PERMISSIONS.PLACA_READ,
    PERMISSIONS.CONTRATO_READ,
    PERMISSIONS.ALUGUEL_READ,
    PERMISSIONS.RELATORIO_READ
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.CLIENTE_READ,
    PERMISSIONS.PLACA_READ,
    PERMISSIONS.CONTRATO_READ,
    PERMISSIONS.ALUGUEL_READ
  ]
} as const;

// ============================================
// TIPOS DE PERÍODO
// ============================================

export const PERIOD_TYPES = {
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUAL: 'annual',
  CUSTOM: 'custom'
} as const;

// ============================================
// CÓDIGOS HTTP
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

// ============================================
// MENSAGENS DE ERRO
// ============================================

export const ERROR_MESSAGES = {
  // Genéricos
  INTERNAL_ERROR: 'Erro interno do servidor',
  VALIDATION_ERROR: 'Erro de validação',
  NOT_FOUND: 'Recurso não encontrado',
  UNAUTHORIZED: 'Não autorizado',
  FORBIDDEN: 'Acesso negado',
  ALREADY_EXISTS: 'Recurso já existe',
  INVALID_ID: 'ID inválido',
  
  // Autenticação
  INVALID_CREDENTIALS: 'Credenciais inválidas',
  TOKEN_EXPIRED: 'Token expirado',
  TOKEN_INVALID: 'Token inválido',
  SESSION_EXPIRED: 'Sessão expirada',
  
  // Cliente
  CLIENTE_NOT_FOUND: 'Cliente não encontrado',
  CLIENTE_ALREADY_EXISTS: 'Cliente já existe',
  CLIENTE_HAS_DEPENDENCIES: 'Cliente possui dependências e não pode ser deletado',
  
  // Placa
  PLACA_NOT_FOUND: 'Placa não encontrada',
  PLACA_NOT_AVAILABLE: 'Placa não disponível',
  PLACA_ALREADY_RENTED: 'Placa já está alugada',
  
  // Contrato
  CONTRATO_NOT_FOUND: 'Contrato não encontrado',
  CONTRATO_ALREADY_EXISTS: 'Contrato já existe para esta PI',
  CONTRATO_CANNOT_DELETE: 'Não é possível deletar este contrato',
  
  // Aluguel
  ALUGUEL_NOT_FOUND: 'Aluguel não encontrado',
  ALUGUEL_OVERLAP: 'Período de aluguel conflita com outro aluguel',
  ALUGUEL_INVALID_DATES: 'Datas de aluguel inválidas',
  
  // Upload
  FILE_TOO_LARGE: 'Arquivo muito grande',
  INVALID_FILE_TYPE: 'Tipo de arquivo inválido',
  UPLOAD_FAILED: 'Falha no upload do arquivo',
  
  // Validação
  REQUIRED_FIELD: 'Campo obrigatório',
  INVALID_EMAIL: 'Email inválido',
  INVALID_CNPJ: 'CNPJ inválido',
  INVALID_CPF: 'CPF inválido',
  INVALID_DATE: 'Data inválida',
  INVALID_DATE_RANGE: 'Período de datas inválido'
} as const;

// ============================================
// MENSAGENS DE SUCESSO
// ============================================

export const SUCCESS_MESSAGES = {
  CREATED: 'Criado com sucesso',
  UPDATED: 'Atualizado com sucesso',
  DELETED: 'Deletado com sucesso',
  SENT: 'Enviado com sucesso',
  UPLOADED: 'Upload realizado com sucesso',
  PROCESSED: 'Processado com sucesso',
  
  // Específicos
  LOGIN_SUCCESS: 'Login realizado com sucesso',
  LOGOUT_SUCCESS: 'Logout realizado com sucesso',
  PASSWORD_RESET: 'Senha resetada com sucesso',
  EMAIL_SENT: 'Email enviado com sucesso',
  PDF_GENERATED: 'PDF gerado com sucesso',
  EXCEL_GENERATED: 'Excel gerado com sucesso'
} as const;

// ============================================
// CONFIGURAÇÕES DE PAGINAÇÃO
// ============================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1
} as const;

// ============================================
// CONFIGURAÇÕES DE UPLOAD
// ============================================

export const UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_IMAGE_SIZE: 2 * 1024 * 1024, // 2MB
  MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
  
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ],
  
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],
  
  FOLDERS: {
    CLIENTES: 'clientes',
    PLACAS: 'placas',
    CONTRATOS: 'contratos',
    PROPOSTAS: 'propostas',
    TEMP: 'temp'
  }
} as const;

// ============================================
// CONFIGURAÇÕES DE CACHE
// ============================================

export const CACHE = {
  TTL: {
    SHORT: 5 * 60, // 5 minutos
    MEDIUM: 30 * 60, // 30 minutos
    LONG: 60 * 60, // 1 hora
    VERY_LONG: 24 * 60 * 60 // 24 horas
  },
  
  KEYS: {
    CLIENTE: 'cliente',
    PLACA: 'placa',
    CONTRATO: 'contrato',
    ALUGUEL: 'aluguel',
    BIWEEK: 'biweek',
    USER: 'user',
    EMPRESA: 'empresa'
  },
  
  PREFIXES: {
    LIST: 'list',
    DETAIL: 'detail',
    COUNT: 'count',
    SEARCH: 'search'
  }
} as const;

// ============================================
// CONFIGURAÇÕES DE JWT
// ============================================

export const JWT = {
  ACCESS_TOKEN_EXPIRY: '7d',
  REFRESH_TOKEN_EXPIRY: '30d',
  ALGORITHM: 'HS256' as const,
  
  COOKIE: {
    NAME: 'refresh_token',
    MAX_AGE: 30 * 24 * 60 * 60 * 1000, // 30 dias em ms
    HTTP_ONLY: true,
    SECURE: process.env.NODE_ENV === 'production',
    SAME_SITE: 'strict' as const
  }
} as const;

// ============================================
// REGEX PATTERNS
// ============================================

export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  CNPJ: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
  CPF: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  PHONE: /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/,
  CEP: /^\d{5}-?\d{3}$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
} as const;

// ============================================
// EVENTOS SSE
// ============================================

export const SSE_EVENTS = {
  ALUGUEL_CREATED: 'aluguel:created',
  ALUGUEL_UPDATED: 'aluguel:updated',
  ALUGUEL_DELETED: 'aluguel:deleted',
  
  CONTRATO_CREATED: 'contrato:created',
  CONTRATO_UPDATED: 'contrato:updated',
  CONTRATO_DELETED: 'contrato:deleted',
  
  PLACA_STATUS_CHANGED: 'placa:status_changed',
  
  NOTIFICATION: 'notification',
  ERROR: 'error'
} as const;

// ============================================
// TIPOS DE LOG
// ============================================

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  VERBOSE: 'verbose'
} as const;

export const LOG_CATEGORIES = {
  AUTH: 'auth',
  API: 'api',
  DATABASE: 'database',
  CACHE: 'cache',
  UPLOAD: 'upload',
  PDF: 'pdf',
  EMAIL: 'email',
  WEBHOOK: 'webhook',
  CRON: 'cron',
  QUEUE: 'queue'
} as const;

// ============================================
// TIMEZONE
// ============================================

export const TIMEZONE = {
  DEFAULT: process.env.TIMEZONE_OFFSET || '-03:00',
  BR: '-03:00',
  UTC: '+00:00'
} as const;

// ============================================
// WHATSAPP
// ============================================

export const WHATSAPP = {
  COUNTRY_CODE: process.env.WHATSAPP_COUNTRY_CODE || '+55',
  MESSAGE_TEMPLATE: {
    CONTRATO_CRIADO: 'Olá {nome}, seu contrato {numero} foi criado com sucesso!',
    ALUGUEL_VENCENDO: 'Olá {nome}, seu aluguel vence em {dias} dias.',
    PAGAMENTO_CONFIRMADO: 'Olá {nome}, seu pagamento foi confirmado!'
  }
} as const;

// ============================================
// LIMITES DE RATE
// ============================================

export const RATE_LIMITS = {
  // Por IP
  GENERAL: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
    MAX_REQUESTS: 100
  },
  
  // Login
  AUTH: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_REQUESTS: 5
  },
  
  // Upload
  UPLOAD: {
    WINDOW_MS: 60 * 60 * 1000, // 1 hora
    MAX_REQUESTS: 20
  },
  
  // API pública
  PUBLIC_API: {
    WINDOW_MS: 60 * 1000, // 1 minuto
    MAX_REQUESTS: 10
  }
} as const;

// ============================================
// FORMATOS DE DATA
// ============================================

export const DATE_FORMATS = {
  BR_DATE: 'DD/MM/YYYY',
  BR_DATETIME: 'DD/MM/YYYY HH:mm',
  BR_DATETIME_FULL: 'DD/MM/YYYY HH:mm:ss',
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  US_DATE: 'MM/DD/YYYY',
  SQL_DATE: 'YYYY-MM-DD',
  SQL_DATETIME: 'YYYY-MM-DD HH:mm:ss'
} as const;

// ============================================
// HELPERS
// ============================================

/**
 * Verifica se tem permissão
 */
export const hasPermission = (role: string, permission: string): boolean => {
  const permissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
  return permissions?.includes(permission as any) || false;
};

/**
 * Verifica se é admin
 */
export const isAdmin = (role: string): boolean => {
  return role === ROLES.ADMIN;
};

/**
 * Obtém mensagem de erro
 */
export const getErrorMessage = (code: keyof typeof ERROR_MESSAGES): string => {
  return ERROR_MESSAGES[code];
};

/**
 * Obtém mensagem de sucesso
 */
export const getSuccessMessage = (code: keyof typeof SUCCESS_MESSAGES): string => {
  return SUCCESS_MESSAGES[code];
};
