import winston from 'winston';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Determina o nível de log baseado no ambiente
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn'; // Produção: apenas warn e error
};

// Lista de mensagens a serem filtradas/silenciadas em desenvolvimento
const silencedPatterns = [
  /\[Gateway\].*→.*- \d{3}/,  // Requisições Gateway individuais
  /\[Metrics\].*\d+\.\d{3}s/, // Métricas de cada request
  /\[BiWeekHelpers\].*debug/, // Debug de BiWeek helpers
  /\[PeriodService\].*debug/, // Debug de Period service
  /\[QueueService\].*debug/,  // Debug de Queue service
];

// Filtro customizado para remover logs verbosos
const filterVerbose = winston.format((info) => {
  // Em produção, não filtra nada
  if (process.env.NODE_ENV === 'production') {
    return info;
  }

  // Em desenvolvimento, filtra padrões silenciados
  const message = String(info.message || '');
  const shouldSilence = silencedPatterns.some(pattern => pattern.test(message));
  
  return shouldSilence ? false : info;
});

const format = winston.format.combine(
  filterVerbose(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize({ all: true })),
  }),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ 
    filename: 'logs/all.log',
    level: 'info' // Não salva debug no arquivo
  }),
];

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Stream for Morgan HTTP logger - simplificado
export const loggerStream = {
  write: (message: string): void => {
    // Só loga HTTP em modo debug explícito
    if (process.env.LOG_HTTP === 'true') {
      logger.http(message.substring(0, message.lastIndexOf('\n')));
    }
  },
};

export default logger;
