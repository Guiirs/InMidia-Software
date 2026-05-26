import mongoose, { Model } from 'mongoose';
import logger from '@shared/container/logger';

type AlertSeverity = 'info' | 'warning' | 'critical';

type AlertDoc = {
  empresaId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  domain: string;
  status: 'open' | 'read' | 'dismissed' | 'resolved';
  read: boolean;
  payload: Record<string, unknown>;
};

function getAlertModel(): Model<AlertDoc> | null {
  return (mongoose.models.AlertV4Record as Model<AlertDoc> | undefined) ?? null;
}

export async function createTemporalAlert(input: {
  empresaId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  payload?: Record<string, unknown>;
}) {
  const AlertRecord = getAlertModel();
  if (!AlertRecord) {
    logger.debug('[TemporalAlertsBridge] AlertV4Record indisponivel; alerta temporal nao materializado', {
      type: input.type,
    });
    return null;
  }

  const existing = await AlertRecord.findOne({
    empresaId: input.empresaId,
    type: input.type,
    status: { $ne: 'resolved' },
    'payload.dedupeKey': input.payload?.dedupeKey,
  }).lean();

  if (existing) return existing;

  return AlertRecord.create({
    empresaId: input.empresaId,
    type: input.type,
    severity: input.severity,
    message: input.message,
    domain: 'temporal',
    status: 'open',
    read: false,
    payload: input.payload ?? {},
  });
}
