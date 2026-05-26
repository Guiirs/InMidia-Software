/* ─── ESTADO MOCKADO DO PREVIEW — V4 PAINEL ──────────────────── */
import { getOverallQualityScore } from '../quality/index.js';
import { PAGE_ROLLOUT_SUMMARY, getLivePages } from '../governance/pageRegistry.js';
import { COMPONENT_SUMMARY } from '../governance/componentRegistry.js';

export const PREVIEW_BUILD_INFO = {
  version:    'v4.0.0-blueprint',
  buildDate:  '2026-05-19',
  parts:      5,
  totalFiles: 185,
  author:     'InMidia Frontend — Roadmap v4',
};

export function getPreviewSystemState() {
  const quality = getOverallQualityScore();

  return {
    build:       PREVIEW_BUILD_INFO,
    quality,
    pages:       PAGE_ROLLOUT_SUMMARY,
    components:  COMPONENT_SUMMARY,
    livePages:   getLivePages().map(p => ({ id: p.id, label: p.label, phase: p.rolloutPhase, featureFlag: p.featureFlag })),
    status: {
      isolamento:     true,
      mockData:       true,
      designSystem:   true,
      governance:     true,
      contracts:      true,
      qualityScore:   quality.overallScore,
      readyForRollout: quality.readyForRollout,
    },
  };
}
