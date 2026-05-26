/* ─── SISTEMA DE LAYOUT — FOUNDATION V4 PAINEL ──────────────── */

export const LAYOUT = {
  SIDEBAR_WIDTH:            220,
  SIDEBAR_COLLAPSED_WIDTH:  56,
  TOPBAR_HEIGHT:            52,
  CONTENT_MAX_WIDTH:        1440,
  CONTENT_PADDING_X:        24,
  CONTENT_PADDING_Y:        20,
};

export const BREAKPOINT = {
  SM:  640,
  MD:  768,
  LG:  1024,
  XL:  1280,
  XXL: 1536,
};

export const DENSITY = {
  COMPACT:  'compact',
  DEFAULT:  'default',
  RELAXED:  'relaxed',
};

export const DENSITY_VALUES = {
  [DENSITY.COMPACT]: {
    rowHeight:   36,
    cardPadding: 12,
    gap:         8,
    fontSize:    12,
  },
  [DENSITY.DEFAULT]: {
    rowHeight:   44,
    cardPadding: 16,
    gap:         16,
    fontSize:    14,
  },
  [DENSITY.RELAXED]: {
    rowHeight:   52,
    cardPadding: 24,
    gap:         24,
    fontSize:    15,
  },
};

export function getDensityValues(density = DENSITY.DEFAULT) {
  return DENSITY_VALUES[density] ?? DENSITY_VALUES[DENSITY.DEFAULT];
}

export const GRID_TEMPLATE = {
  METRICS_4:  'repeat(4, 1fr)',
  METRICS_3:  'repeat(3, 1fr)',
  METRICS_2:  'repeat(2, 1fr)',
  TWO_THIRDS: '2fr 1fr',
  SIDEBAR:    '240px 1fr',
  EQUAL:      '1fr 1fr',
};
