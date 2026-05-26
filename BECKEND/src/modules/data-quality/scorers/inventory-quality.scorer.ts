import type { DataQualityContext } from '../contracts/data-quality.contracts';

export class InventoryQualityScorer {
  score(context: DataQualityContext): number {
    const summary = context.snapshot?.inventory.summary;
    if (!summary || summary.total === 0) return 100;

    const conflictPenalty = Math.min(45, (summary.conflicts / summary.total) * 45);
    const incompletePenalty = Math.min(35, (summary.incomplete / summary.total) * 35);
    const unknownPenalty = Math.min(20, (summary.unknown / summary.total) * 20);

    return Math.max(0, Math.round(100 - conflictPenalty - incompletePenalty - unknownPenalty));
  }
}
