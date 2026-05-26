// INMIDIA DESIGN SYSTEM — Global Tokens
// Source of truth for all design decisions.
// Do NOT hardcode values in components — reference these tokens.

// ─── COLOR PRIMITIVES ────────────────────────────────────────────────────────
// Raw color scale (Slate palette — enterprise-grade neutral)
export const colors = {
  slate: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  blue: {
    50:  '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    900: '#1E3A8A',
  },
  green: {
    50:  '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
  },
  amber: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  red: {
    50:  '#FFF5F5',
    100: '#FEE2E2',
    200: '#FECACA',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },
  cyan: {
    50:  '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    500: '#06B6D4',
    600: '#0891B2',
    700: '#0E7490',
  },
  violet: {
    50:  '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
  },
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
};

// ─── SEMANTIC COLORS ─────────────────────────────────────────────────────────
export const semanticColors = {
  // Light mode surface/text tokens
  light: {
    background:      colors.slate[50],   // #F8FAFC — page bg
    surface:         colors.white,        // #FFFFFF — cards, panels
    surfaceElevated: colors.slate[100],  // #F1F5F9 — hover, nested surfaces
    border:          colors.slate[200],  // #E2E8F0 — default border
    borderSubtle:    colors.slate[100],  // #F1F5F9 — very subtle dividers
    textPrimary:     colors.slate[900],  // #0F172A
    textSecondary:   colors.slate[600],  // #475569
    textMuted:       colors.slate[500],  // #64748B
    textInverse:     colors.white,
  },
  // Dark mode surface/text tokens (prepared, not active yet)
  dark: {
    background:      colors.slate[950],  // #020617
    surface:         colors.slate[900],  // #0F172A
    surfaceElevated: colors.slate[800],  // #1E293B
    border:          colors.slate[700],  // #334155
    borderSubtle:    colors.slate[800],  // #1E293B
    textPrimary:     colors.slate[50],   // #F8FAFC
    textSecondary:   colors.slate[300],  // #CBD5E1
    textMuted:       colors.slate[400],  // #94A3B8
    textInverse:     colors.slate[900],
  },
  // Brand / semantic — mode-agnostic
  primary:            colors.blue[600],   // #2563EB
  primaryHover:       colors.blue[700],
  primaryActive:      colors.blue[900],
  primarySoft:        colors.blue[100],   // #DBEAFE
  primarySubtle:      colors.blue[50],

  success:            colors.green[600],  // #16A34A
  successHover:       colors.green[700],
  successSoft:        colors.green[100],  // #DCFCE7
  successSubtle:      colors.green[50],

  warning:            colors.amber[600],  // #D97706
  warningHover:       colors.amber[700],
  warningSoft:        colors.amber[100],  // #FEF3C7
  warningSubtle:      colors.amber[50],

  danger:             colors.red[600],    // #DC2626
  dangerHover:        colors.red[700],
  dangerSoft:         colors.red[100],    // #FEE2E2
  dangerSubtle:       colors.red[50],

  info:               colors.cyan[600],   // #0891B2
  infoHover:          colors.cyan[700],
  infoSoft:           colors.cyan[100],   // #CFFAFE
  infoSubtle:         colors.cyan[50],

  intelligence:       colors.violet[600], // #7C3AED
  intelligenceHover:  colors.violet[700],
  intelligenceSoft:   colors.violet[100], // #EDE9FE
  intelligenceSubtle: colors.violet[50],
};

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────────
export const typography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', sans-serif",
    mono: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Courier New', monospace",
  },
  // rem values assume html { font-size: 62.5% } → 1rem = 10px
  fontSize: {
    xs:   '1.2rem',  // 12px
    sm:   '1.4rem',  // 14px
    base: '1.6rem',  // 16px
    lg:   '1.8rem',  // 18px
    xl:   '2rem',    // 20px
    '2xl': '2.4rem', // 24px
    '3xl': '3rem',   // 30px
    '4xl': '3.6rem', // 36px
    '5xl': '4.8rem', // 48px
  },
  fontWeight: {
    normal:    400,
    medium:    500,
    semibold:  600,
    bold:      700,
    extrabold: 800,
  },
  lineHeight: {
    none:     1,
    tight:    1.25,
    snug:     1.375,
    normal:   1.5,
    relaxed:  1.625,
    loose:    2,
  },
  letterSpacing: {
    tighter: '-0.05em',
    tight:   '-0.025em',
    normal:  '0',
    wide:    '0.025em',
    wider:   '0.05em',
    widest:  '0.1em',
  },
};

// ─── SPACING (4px base grid) ──────────────────────────────────────────────────
export const spacing = {
  0:    '0',
  px:   '0.1rem',   // 1px
  0.5:  '0.2rem',   // 2px
  1:    '0.4rem',   // 4px  ← xs
  1.5:  '0.6rem',   // 6px
  2:    '0.8rem',   // 8px  ← sm
  3:    '1.2rem',   // 12px ← md
  4:    '1.6rem',   // 16px ← base
  5:    '2rem',     // 20px
  6:    '2.4rem',   // 24px ← lg
  7:    '2.8rem',   // 28px
  8:    '3.2rem',   // 32px ← xl
  10:   '4rem',     // 40px ← 2xl
  12:   '4.8rem',   // 48px ← 3xl
  16:   '6.4rem',   // 64px ← 4xl
  20:   '8rem',     // 80px ← 5xl
  24:   '9.6rem',   // 96px ← 6xl
  // Named aliases
  xs:   '0.4rem',
  sm:   '0.8rem',
  md:   '1.2rem',
  base: '1.6rem',
  lg:   '2.4rem',
  xl:   '3.2rem',
  '2xl': '4rem',
  '3xl': '4.8rem',
  '4xl': '6.4rem',
};

// ─── BORDER RADIUS ───────────────────────────────────────────────────────────
export const radius = {
  none:  '0',
  xs:    '0.2rem',  // 2px
  sm:    '0.4rem',  // 4px
  base:  '0.6rem',  // 6px
  md:    '0.8rem',  // 8px
  lg:    '1rem',    // 10px
  xl:    '1.2rem',  // 12px
  '2xl': '1.6rem',  // 16px
  '3xl': '2.4rem',  // 24px
  full:  '9999px',
};

// ─── SHADOWS ─────────────────────────────────────────────────────────────────
export const shadows = {
  none:  'none',
  xs:    '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm:    '0 1px 3px 0 rgba(0, 0, 0, 0.10), 0 1px 2px -1px rgba(0, 0, 0, 0.10)',
  base:  '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)',
  md:    '0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 4px 6px -4px rgba(0, 0, 0, 0.10)',
  lg:    '0 20px 25px -5px rgba(0, 0, 0, 0.10), 0 8px 10px -6px rgba(0, 0, 0, 0.10)',
  xl:    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  // Semantic elevation shadows
  card:      '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
  cardHover: '0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
  modal:     '0 20px 60px -10px rgba(0, 0, 0, 0.20)',
  // Colored glows for emphasis
  primary:     '0 4px 14px 0 rgba(37, 99, 235, 0.25)',
  success:     '0 4px 14px 0 rgba(22, 163, 74, 0.25)',
  danger:      '0 4px 14px 0 rgba(220, 38, 38, 0.25)',
  warning:     '0 4px 14px 0 rgba(217, 119, 6, 0.25)',
  intelligence:'0 4px 14px 0 rgba(124, 58, 237, 0.25)',
};

// ─── BORDERS ─────────────────────────────────────────────────────────────────
export const borders = {
  width: {
    none:  '0',
    thin:  '1px',
    base:  '1px',
    thick: '2px',
  },
  style: {
    solid:  'solid',
    dashed: 'dashed',
    dotted: 'dotted',
  },
};

// ─── LAYOUT ──────────────────────────────────────────────────────────────────
export const layout = {
  sidebarExpanded:  '26rem',
  sidebarCollapsed: '10rem',
  contentMaxWidth:  '140rem',  // 1400px
  headerHeight:     '6.4rem',  // 64px
};

// ─── Z-INDEX ─────────────────────────────────────────────────────────────────
export const zIndex = {
  behind:        -1,
  base:           0,
  raised:         1,
  dropdown:    1000,
  sticky:      1020,
  fixed:       1030,
  modalBackdrop: 1040,
  modal:       1050,
  popover:     1060,
  tooltip:     1070,
  toast:       1080,
};

// ─── TRANSITIONS ─────────────────────────────────────────────────────────────
export const transitions = {
  duration: {
    instant:  '0ms',
    fast:     '100ms',
    base:     '200ms',
    slow:     '300ms',
    slower:   '500ms',
  },
  easing: {
    linear:    'linear',
    easeIn:    'cubic-bezier(0.4, 0, 1, 1)',
    easeOut:   'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring:    'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  // Ready-to-use CSS transition presets
  all:       'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  colors:    'color 200ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  transform: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  opacity:   'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  shadow:    'box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// ─── TOKENS BUNDLE ───────────────────────────────────────────────────────────
const tokens = {
  colors,
  semanticColors,
  typography,
  spacing,
  radius,
  shadows,
  borders,
  layout,
  zIndex,
  transitions,
};

export default tokens;
