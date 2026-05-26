/**
 * Mensagens de Validação Zod - Padrão PT-BR
 * Centraliza todas as mensagens de erro para manter consistência
 */

/**
 * Mensagens genéricas de validação
 */
export const ValidationMessages = {
  // Campos obrigatórios
  required: (campo: string) => `${campo} é obrigatório`,
  requiredSelect: (campo: string) => `Selecione ${campo}`,
  
  // String validations
  minLength: (campo: string, min: number) => `${campo} deve ter no mínimo ${min} caracteres`,
  maxLength: (campo: string, max: number) => `${campo} deve ter no máximo ${max} caracteres`,
  exactLength: (campo: string, length: number) => `${campo} deve ter exatamente ${length} caracteres`,
  
  // Number validations
  minValue: (campo: string, min: number) => `${campo} deve ser no mínimo ${min}`,
  maxValue: (campo: string, max: number) => `${campo} deve ser no máximo ${max}`,
  positive: (campo: string) => `${campo} deve ser um número positivo`,
  negative: (campo: string) => `${campo} deve ser um número negativo`,
  integer: (campo: string) => `${campo} deve ser um número inteiro`,
  
  // Date validations
  invalidDate: (campo: string) => `${campo} inválida`,
  minDate: (campo: string, min: string) => `${campo} deve ser posterior a ${min}`,
  maxDate: (campo: string, max: string) => `${campo} deve ser anterior a ${max}`,
  futureDate: (campo: string) => `${campo} deve ser uma data futura`,
  pastDate: (campo: string) => `${campo} deve ser uma data passada`,
  
  // Format validations
  invalidFormat: (campo: string) => `Formato de ${campo} inválido`,
  invalidEmail: 'Email inválido',
  invalidUrl: 'URL inválida',
  invalidUuid: 'ID inválido',
  invalidPhone: 'Telefone inválido. Use o formato (XX) XXXXX-XXXX',
  invalidCep: 'CEP inválido. Use o formato XXXXX-XXX',
  invalidCnpj: 'CNPJ inválido. Use 14 dígitos',
  invalidCpf: 'CPF inválido. Use 11 dígitos',
  invalidCpfCnpj: 'CPF/CNPJ inválido',
  
  // Array validations
  minItems: (campo: string, min: number) => `${campo} deve ter no mínimo ${min} item(ns)`,
  maxItems: (campo: string, max: number) => `${campo} deve ter no máximo ${max} item(ns)`,
  emptyArray: (campo: string) => `${campo} não pode estar vazio`,
  
  // Enum validations
  invalidOption: (campo: string, options: string[]) => 
    `${campo} inválido. Opções válidas: ${options.join(', ')}`,
  
  // Boolean validations
  mustBeBoolean: (campo: string) => `${campo} deve ser verdadeiro ou falso`,
  
  // Object validations
  invalidObject: (campo: string) => `${campo} deve ser um objeto válido`,
  
  // File validations
  invalidFile: 'Arquivo inválido',
  fileTooLarge: (max: string) => `Arquivo muito grande. Tamanho máximo: ${max}`,
  invalidFileType: (types: string[]) => `Tipo de arquivo inválido. Tipos aceitos: ${types.join(', ')}`,
  
  // Coordinates
  invalidLatitude: 'Latitude inválida (deve estar entre -90 e 90)',
  invalidLongitude: 'Longitude inválida (deve estar entre -180 e 180)',
  invalidCoordinates: 'Coordenadas inválidas',
  
  // Password
  passwordMinLength: (min: number) => `Senha deve ter no mínimo ${min} caracteres`,
  passwordMismatch: 'As senhas não coincidem',
  weakPassword: 'Senha fraca. Use letras maiúsculas, minúsculas, números e caracteres especiais',
  
  // Dates period
  startAfterEnd: 'Data de início deve ser anterior à data de fim',
  endBeforeStart: 'Data de fim deve ser posterior à data de início',
  invalidPeriod: 'Período inválido',
  periodOverlap: 'Período conflita com outro registro',
  
  // Business rules
  alreadyExists: (campo: string) => `${campo} já cadastrado`,
  notFound: (campo: string) => `${campo} não encontrado`,
  inUse: (campo: string) => `${campo} está em uso e não pode ser removido`,
  unavailable: (campo: string) => `${campo} não disponível`,
  
  // API
  invalidApiKey: 'API Key inválida',
  expiredApiKey: 'API Key expirada',
  
  // Custom
  custom: (mensagem: string) => mensagem,
} as const;

/**
 * Mensagens específicas por tipo de campo
 */
export const FieldMessages = {
  // Campos de identificação
  nome: {
    required: ValidationMessages.required('Nome'),
    min: ValidationMessages.minLength('Nome', 3),
    max: ValidationMessages.maxLength('Nome', 200),
  },
  email: {
    required: ValidationMessages.required('Email'),
    invalid: ValidationMessages.invalidEmail,
  },
  telefone: {
    invalid: ValidationMessages.invalidPhone,
  },
  cpf: {
    invalid: ValidationMessages.invalidCpf,
  },
  cnpj: {
    invalid: ValidationMessages.invalidCnpj,
  },
  cpfCnpj: {
    invalid: ValidationMessages.invalidCpfCnpj,
    min: ValidationMessages.minLength('CPF/CNPJ', 11),
  },
  cep: {
    invalid: ValidationMessages.invalidCep,
  },
  
  // Campos de endereço
  endereco: {
    max: ValidationMessages.maxLength('Endereço', 500),
  },
  cidade: {
    max: ValidationMessages.maxLength('Cidade', 100),
  },
  estado: {
    invalid: 'Estado deve ter 2 caracteres (UF)',
    exact: ValidationMessages.exactLength('Estado', 2),
  },
  
  // Campos de descrição
  descricao: {
    max: ValidationMessages.maxLength('Descrição', 1000),
  },
  observacoes: {
    max: ValidationMessages.maxLength('Observações', 2000),
  },
  
  // Campos numéricos
  valor: {
    positive: ValidationMessages.positive('Valor'),
    min: ValidationMessages.minValue('Valor', 0),
  },
  quantidade: {
    positive: ValidationMessages.positive('Quantidade'),
    integer: ValidationMessages.integer('Quantidade'),
    min: ValidationMessages.minValue('Quantidade', 1),
  },
  
  // Datas
  dataInicio: {
    required: ValidationMessages.required('Data de início'),
    invalid: ValidationMessages.invalidDate('Data de início'),
  },
  dataFim: {
    required: ValidationMessages.required('Data de fim'),
    invalid: ValidationMessages.invalidDate('Data de fim'),
  },
  
  // Placa
  numeroPlaca: {
    required: ValidationMessages.required('Número da placa'),
    max: ValidationMessages.maxLength('Número da placa', 50),
  },
  tipo: {
    invalid: 'Tipo de placa inválido',
  },
  
  // Coordenadas
  latitude: {
    invalid: ValidationMessages.invalidLatitude,
  },
  longitude: {
    invalid: ValidationMessages.invalidLongitude,
  },
  
  // Região
  regiao: {
    required: ValidationMessages.requiredSelect('uma região'),
  },
  
  // Cliente
  cliente: {
    required: ValidationMessages.requiredSelect('um cliente'),
  },
  
  // Status
  status: {
    invalid: 'Status inválido',
  },
  ativo: {
    mustBeBoolean: ValidationMessages.mustBeBoolean('Ativo'),
  },
} as const;

/**
 * Helper para criar mensagem de enum inválido com opções
 */
export function enumMessage(campo: string, values: readonly string[]): string {
  return `${campo} inválido. Opções: ${values.join(', ')}`;
}

/**
 * Helper para criar mensagem de tamanho de array
 */
export function arrayMessage(campo: string, min?: number, max?: number): {
  min?: string;
  max?: string;
} {
  return {
    min: min ? ValidationMessages.minItems(campo, min) : undefined,
    max: max ? ValidationMessages.maxItems(campo, max) : undefined,
  };
}
