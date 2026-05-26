import type { DataQualityContext } from '../contracts/data-quality.contracts';

export class OperationalQualityScorer {
  score(context: DataQualityContext): number {
    const items = context.snapshot?.inventory.items ?? [];
    if (items.length === 0) return 100;

    const missingOperational = items.filter((item) => !item.numeroOperacional).length;
    const attention = items.filter((item) => item.status.operational === 'attention').length;
    const conflict = items.filter((item) => item.status.operational === 'conflict').length;
    const incomplete = items.filter((item) => item.status.operational === 'incomplete').length;

    return Math.max(0, Math.round(100 - ((missingOperational + attention + incomplete) / items.length) * 50 - (conflict / items.length) * 50));
  }
}
