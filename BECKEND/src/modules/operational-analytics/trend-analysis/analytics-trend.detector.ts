import type {
  AnalyticsSeverity,
  AnalyticsSnapshot,
  AnalyticsTrend,
} from '../contracts/operational-analytics.contracts';

interface TrendInput {
  key: string;
  label: string;
  currentValue: number;
  previousValue: number;
  upMessage: string;
  downMessage: string;
}

function severityForDelta(delta: number): AnalyticsSeverity {
  const magnitude = Math.abs(delta);
  if (magnitude >= 20) return 'critical';
  if (magnitude >= 10) return 'high';
  if (magnitude >= 5) return 'medium';
  return 'low';
}

export class AnalyticsTrendDetector {
  detect(currentSnapshot: AnalyticsSnapshot, previousSnapshot?: AnalyticsSnapshot): AnalyticsTrend[] {
    if (!previousSnapshot) return [];

    const trends: AnalyticsTrend[] = [];

    this.pushTrend(trends, {
      key: 'availability.change',
      label: 'Disponibilidade operacional',
      currentValue: currentSnapshot.summary.availabilityRate,
      previousValue: previousSnapshot.summary.availabilityRate,
      upMessage: 'Aumento de disponibilidade identificado em relacao ao snapshot anterior.',
      downMessage: 'Reducao de disponibilidade identificada em relacao ao snapshot anterior.',
    });
    this.pushTrend(trends, {
      key: 'quality.change',
      label: 'Qualidade operacional',
      currentValue: currentSnapshot.quality.globalScore,
      previousValue: previousSnapshot.quality.globalScore,
      upMessage: 'Recuperacao de qualidade operacional em relacao ao snapshot anterior.',
      downMessage: 'Degradacao de qualidade operacional em relacao ao snapshot anterior.',
    });
    this.pushTrend(trends, {
      key: 'conflicts.change',
      label: 'Conflitos operacionais',
      currentValue: currentSnapshot.aggregations.byConflicts.total,
      previousValue: previousSnapshot.aggregations.byConflicts.total,
      upMessage: 'Aumento de conflitos operacionais detectado.',
      downMessage: 'Reducao de conflitos operacionais detectada.',
    });
    this.pushTrend(trends, {
      key: 'territorial.change',
      label: 'Cobertura territorial',
      currentValue: currentSnapshot.summary.coveredRegions,
      previousValue: previousSnapshot.summary.coveredRegions,
      upMessage: 'Crescimento territorial identificado no snapshot atual.',
      downMessage: 'Reducao de cobertura territorial identificada.',
    });
    this.pushTrend(trends, {
      key: 'media.change',
      label: 'Midia valida',
      currentValue: currentSnapshot.quality.mediaScore,
      previousValue: previousSnapshot.quality.mediaScore,
      upMessage: 'Crescimento de midia valida em relacao ao snapshot anterior.',
      downMessage: 'Reducao de midia valida em relacao ao snapshot anterior.',
    });
    this.pushTrend(trends, {
      key: 'occupancy.change',
      label: 'Ocupacao operacional',
      currentValue: currentSnapshot.summary.occupancyRate,
      previousValue: previousSnapshot.summary.occupancyRate,
      upMessage: 'Aumento de ocupacao operacional detectado.',
      downMessage: 'Reducao de ocupacao operacional detectada.',
    });

    const activeDelta = currentSnapshot.summary.placasAtivas - previousSnapshot.summary.placasAtivas;
    if (activeDelta < 0) {
      trends.push({
        key: 'operational.drop',
        label: 'Queda operacional',
        direction: 'down',
        severity: severityForDelta(activeDelta),
        message: 'Queda operacional detectada pela reducao de placas ativas.',
        delta: Number(activeDelta.toFixed(2)),
        currentValue: currentSnapshot.summary.placasAtivas,
        previousValue: previousSnapshot.summary.placasAtivas,
      });
    }

    return trends.sort((left, right) => {
      const weight: Record<AnalyticsSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return weight[right.severity] - weight[left.severity] || Math.abs(right.delta) - Math.abs(left.delta);
    });
  }

  private pushTrend(target: AnalyticsTrend[], input: TrendInput): void {
    const delta = Number((input.currentValue - input.previousValue).toFixed(2));
    if (delta === 0) return;

    target.push({
      key: input.key,
      label: input.label,
      direction: delta > 0 ? 'up' : 'down',
      severity: severityForDelta(delta),
      message: delta > 0 ? input.upMessage : input.downMessage,
      delta,
      currentValue: Number(input.currentValue.toFixed(2)),
      previousValue: Number(input.previousValue.toFixed(2)),
    });
  }
}