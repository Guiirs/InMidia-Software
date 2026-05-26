// INMIDIA DESIGN SYSTEM — Public API
// Single entry point for all design system exports.
//
// Usage:
//   import { tokens, lightTheme, darkTheme } from '@/design';
//   import { semanticColors, spacing } from '@/design/tokens';
//   import { createInmidiaTheme } from '@/design/theme';

// ─── TOKENS ──────────────────────────────────────────────────────────────────
export {
  default as tokens,
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
} from './tokens';

// ─── THEMES ──────────────────────────────────────────────────────────────────
export {
  default as lightTheme,
  darkTheme,
  createInmidiaTheme,
} from './theme';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Returns the CSS variable reference for a design token.
 * e.g. cssVar('ds-primary') → 'var(--ds-primary)'
 */
export const cssVar = (name) => `var(--${name})`;

/**
 * Returns the hex value of a semantic color by key (light mode).
 * Useful for inline styles or canvas APIs that don't accept CSS vars.
 */
export const getColor = (key) => {
  const { semanticColors: sc } = require('./tokens');
  return sc.light[key] ?? sc[key] ?? null;
};

/**
 * Creates a CSS transition string from token names.
 * e.g. makeTransition(['opacity', 'transform']) →
 *      'opacity 200ms cubic-bezier(...), transform 200ms cubic-bezier(...)'
 */
export const makeTransition = (
  properties = ['all'],
  duration    = '200ms',
  easing      = 'cubic-bezier(0.4, 0, 0.2, 1)',
) =>
  properties.map((p) => `${p} ${duration} ${easing}`).join(', ');

/**
 * Clamps a spacing value to the defined token scale.
 * Returns the rem value if the key exists, or the raw value otherwise.
 */
export const sp = (key) => {
  const { spacing } = require('./tokens');
  return spacing[key] ?? key;
};
