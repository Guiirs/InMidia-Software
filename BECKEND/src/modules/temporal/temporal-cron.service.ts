import cron, { type ScheduledTask } from 'node-cron';
import logger from '@shared/container/logger';
import { temporalSchedulerService } from './temporal-scheduler.service';
import { temporalEngine } from './temporal.service';

type TemporalCronSummary = Awaited<ReturnType<typeof temporalSchedulerService.runDailyTemporalMaintenance>> & {
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED_ALREADY_RUNNING';
};

export type TemporalCronStatus = {
  enabled: boolean;
  running: boolean;
  cronExpression: string;
  daysBeforeEnd: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastSummary: TemporalCronSummary | null;
};

function parseEnabled(value: string | undefined): boolean {
  return String(value || '').trim().toLowerCase() === 'true';
}

function parseDays(value: string | undefined): number {
  const parsed = Number(value ?? 7);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

export class TemporalCronService {
  private task: ScheduledTask | null = null;
  private running = false;
  private enabled = false;
  private cronExpression = process.env.TEMPORAL_SCHEDULER_CRON || '0 3 * * *';
  private daysBeforeEnd = parseDays(process.env.TEMPORAL_SCHEDULER_DAYS_BEFORE_END);
  private lastRunAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private lastErrorAt: Date | null = null;
  private lastErrorMessage: string | null = null;
  private lastSummary: TemporalCronSummary | null = null;

  shouldAutoStart(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.NODE_ENV === 'test') return false;
    return parseEnabled(env.TEMPORAL_SCHEDULER_ENABLED);
  }

  start(env: NodeJS.ProcessEnv = process.env): TemporalCronStatus {
    this.cronExpression = env.TEMPORAL_SCHEDULER_CRON || '0 3 * * *';
    this.daysBeforeEnd = parseDays(env.TEMPORAL_SCHEDULER_DAYS_BEFORE_END);
    this.enabled = this.shouldAutoStart(env);

    if (!this.enabled) {
      logger.info('[TemporalCron] Scheduler temporal desativado por feature flag.');
      return this.getStatus();
    }

    if (this.task) {
      logger.warn('[TemporalCron] Scheduler temporal ja estava registrado.');
      return this.getStatus();
    }

    if (!cron.validate(this.cronExpression)) {
      this.enabled = false;
      this.lastErrorAt = new Date();
      this.lastErrorMessage = `Expressao cron invalida: ${this.cronExpression}`;
      logger.error(`[TemporalCron] ${this.lastErrorMessage}`);
      return this.getStatus();
    }

    this.task = cron.schedule(this.cronExpression, () => {
      void this.runNow('cron');
    });

    logger.info('[TemporalCron] Scheduler temporal registrado', {
      cronExpression: this.cronExpression,
      daysBeforeEnd: this.daysBeforeEnd,
    });

    return this.getStatus();
  }

  stop(): TemporalCronStatus {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.enabled = false;
    return this.getStatus();
  }

  async runNow(trigger: 'manual' | 'cron' = 'manual'): Promise<TemporalCronSummary> {
    if (this.running) {
      const summary: TemporalCronSummary = { status: 'SKIPPED_ALREADY_RUNNING' };
      this.lastSummary = summary;
      logger.warn('[TemporalCron] Execucao ignorada: manutencao temporal ja esta em andamento', { trigger });
      await this.recordSchedulerEvent('TEMPORAL_SCHEDULER_SKIPPED_ALREADY_RUNNING', 'Manutencao temporal ignorada por execucao concorrente.', { trigger });
      return summary;
    }

    this.running = true;
    this.lastRunAt = new Date();
    this.lastErrorMessage = null;

    logger.info('[TemporalCron] Iniciando manutencao temporal', { trigger });
    await this.recordSchedulerEvent('TEMPORAL_SCHEDULER_STARTED', 'Manutencao temporal iniciada.', { trigger });

    try {
      const result = await temporalSchedulerService.runDailyTemporalMaintenance(this.daysBeforeEnd);
      const summary: TemporalCronSummary = { ...result, status: 'SUCCESS' };
      this.lastSuccessAt = new Date();
      this.lastSummary = summary;
      logger.info('[TemporalCron] Manutencao temporal concluida', summary);
      await this.recordSchedulerEvent('TEMPORAL_SCHEDULER_COMPLETED', 'Manutencao temporal concluida.', { trigger, summary });
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const summary: TemporalCronSummary = { status: 'FAILED' };
      this.lastErrorAt = new Date();
      this.lastErrorMessage = message;
      this.lastSummary = summary;
      logger.error('[TemporalCron] Falha na manutencao temporal', { error: message, trigger });
      await this.recordSchedulerEvent('TEMPORAL_SCHEDULER_FAILED', 'Falha na manutencao temporal.', { trigger, error: message });
      return summary;
    } finally {
      this.running = false;
    }
  }

  getStatus(): TemporalCronStatus {
    return {
      enabled: this.enabled,
      running: this.running,
      cronExpression: this.cronExpression,
      daysBeforeEnd: this.daysBeforeEnd,
      lastRunAt: this.lastRunAt?.toISOString() ?? null,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastErrorAt: this.lastErrorAt?.toISOString() ?? null,
      lastErrorMessage: this.lastErrorMessage,
      lastSummary: this.lastSummary,
    };
  }

  resetForTests(): void {
    this.stop();
    this.running = false;
    this.enabled = false;
    this.cronExpression = process.env.TEMPORAL_SCHEDULER_CRON || '0 3 * * *';
    this.daysBeforeEnd = parseDays(process.env.TEMPORAL_SCHEDULER_DAYS_BEFORE_END);
    this.lastRunAt = null;
    this.lastSuccessAt = null;
    this.lastErrorAt = null;
    this.lastErrorMessage = null;
    this.lastSummary = null;
  }

  private async recordSchedulerEvent(eventType: Parameters<typeof temporalEngine.recordEvent>[0]['eventType'], message: string, metadata: Record<string, unknown>) {
    const empresaId = process.env.TEMPORAL_SCHEDULER_SYSTEM_EMPRESA_ID;
    if (!empresaId) return;
    await temporalEngine.recordEvent({ empresaId, eventType, message, metadata });
  }
}

export const temporalCronService = new TemporalCronService();
