import logger from '../shared/container/logger';

/**
 * Cron de atualização de status.
 *
 * Atualmente desativado no runtime (`server.ts`), mas mantido como stub para:
 * - preservar compatibilidade de imports antigos
 * - não quebrar `tsc`/`type-check`
 *
 * Quando o cron voltar, reimplementar em módulo novo sem dependências de PI/Contratos.
 */
const iniciarCronJobs = (): void => {
  logger.warn('[CRON JOB] updateStatusJob desativado (stub). Nenhuma tarefa agendada foi iniciada.');
};

export default iniciarCronJobs;
