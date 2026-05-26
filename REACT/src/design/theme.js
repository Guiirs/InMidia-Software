// INMIDIA DESIGN SYSTEM — MUI Theme
// Builds a Material UI theme from design tokens.
// Supports light/dark mode. Only light is active by default.

import { createTheme, alpha } from '@mui/material/styles';
import tokens from './tokens';

const { colors, semanticColors, typography, radius, shadows, transitions } = tokens;

// ─── THEME FACTORY ───────────────────────────────────────────────────────────
const createInmidiaTheme = (mode = 'light') => {
  const sc = mode === 'dark' ? semanticColors.dark : semanticColors.light;

  return createTheme({
    // ── Palette ────────────────────────────────────────────────────────────
    palette: {
      mode,
      background: {
        default: sc.background,
        paper:   sc.surface,
      },
      text: {
        primary:   sc.textPrimary,
        secondary: sc.textSecondary,
        disabled:  sc.textMuted,
      },
      primary: {
        main:         semanticColors.primary,
        light:        semanticColors.primarySoft,
        dark:         semanticColors.primaryHover,
        contrastText: colors.white,
      },
      secondary: {
        main:         semanticColors.intelligence,
        light:        semanticColors.intelligenceSoft,
        dark:         semanticColors.intelligenceHover,
        contrastText: colors.white,
      },
      success: {
        main:         semanticColors.success,
        light:        semanticColors.successSoft,
        dark:         semanticColors.successHover,
        contrastText: colors.white,
      },
      warning: {
        main:         semanticColors.warning,
        light:        semanticColors.warningSoft,
        dark:         semanticColors.warningHover,
        contrastText: colors.white,
      },
      error: {
        main:         semanticColors.danger,
        light:        semanticColors.dangerSoft,
        dark:         semanticColors.dangerHover,
        contrastText: colors.white,
      },
      info: {
        main:         semanticColors.info,
        light:        semanticColors.infoSoft,
        dark:         semanticColors.infoHover,
        contrastText: colors.white,
      },
      divider: sc.border,
      action: {
        hover:           alpha(sc.textPrimary, 0.04),
        selected:        alpha(semanticColors.primary, 0.08),
        disabled:        alpha(sc.textPrimary, 0.26),
        disabledBackground: alpha(sc.textPrimary, 0.12),
        focus:           alpha(semanticColors.primary, 0.12),
      },
    },

    // ── Typography ─────────────────────────────────────────────────────────
    typography: {
      fontFamily:   typography.fontFamily.sans,
      fontSize:     14,
      htmlFontSize: 10, // synced with html { font-size: 62.5% }
      h1: { fontSize: '3.6rem', fontWeight: typography.fontWeight.bold,      lineHeight: 1.25, letterSpacing: '-0.025em' },
      h2: { fontSize: '3rem',   fontWeight: typography.fontWeight.bold,      lineHeight: 1.25, letterSpacing: '-0.025em' },
      h3: { fontSize: '2.4rem', fontWeight: typography.fontWeight.semibold,  lineHeight: 1.375 },
      h4: { fontSize: '2rem',   fontWeight: typography.fontWeight.semibold,  lineHeight: 1.375 },
      h5: { fontSize: '1.8rem', fontWeight: typography.fontWeight.semibold,  lineHeight: 1.5   },
      h6: { fontSize: '1.6rem', fontWeight: typography.fontWeight.semibold,  lineHeight: 1.5   },
      subtitle1: { fontSize: '1.6rem', fontWeight: typography.fontWeight.medium,  lineHeight: 1.5   },
      subtitle2: { fontSize: '1.4rem', fontWeight: typography.fontWeight.medium,  lineHeight: 1.5   },
      body1:     { fontSize: '1.6rem', fontWeight: typography.fontWeight.normal,  lineHeight: 1.5   },
      body2:     { fontSize: '1.4rem', fontWeight: typography.fontWeight.normal,  lineHeight: 1.5   },
      caption:   { fontSize: '1.2rem', fontWeight: typography.fontWeight.normal,  lineHeight: 1.625 },
      overline:  { fontSize: '1.1rem', fontWeight: typography.fontWeight.semibold, lineHeight: 2.5, letterSpacing: '0.1em', textTransform: 'uppercase' },
      button:    { fontSize: '1.4rem', fontWeight: typography.fontWeight.semibold, textTransform: 'none', letterSpacing: '0' },
    },

    // ── Shape ──────────────────────────────────────────────────────────────
    shape: {
      borderRadius: 8, // 8px — maps to radius.md
    },

    // ── Transitions ────────────────────────────────────────────────────────
    transitions: {
      duration: {
        shortest:      100,
        shorter:       150,
        short:         200,
        standard:      250,
        complex:       375,
        enteringScreen: 225,
        leavingScreen:  195,
      },
      easing: {
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeOut:   'cubic-bezier(0, 0, 0.2, 1)',
        easeIn:    'cubic-bezier(0.4, 0, 1, 1)',
        sharp:     'cubic-bezier(0.4, 0, 0.6, 1)',
      },
    },

    // ── Shadows ────────────────────────────────────────────────────────────
    shadows: [
      'none',
      shadows.xs,
      shadows.sm,
      shadows.base,
      shadows.card,
      shadows.md,
      shadows.md,
      shadows.md,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
      shadows.xl,
    ],

    // ── Component Overrides ────────────────────────────────────────────────
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // Let our index.css handle global resets — MUI only patches gaps
          '*, *::before, *::after': { boxSizing: 'border-box' },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            fontWeight:   typography.fontWeight.semibold,
            fontSize:     '1.4rem',
            padding:      '0.8rem 1.6rem',
            transition:   transitions.all,
          },
          sizeSmall:  { padding: '0.6rem 1.2rem', fontSize: '1.2rem' },
          sizeLarge:  { padding: '1.2rem 2.4rem', fontSize: '1.6rem' },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius:  radius['2xl'],
            border:        `1px solid ${sc.border}`,
            boxShadow:     shadows.card,
            transition:    `${transitions.shadow}, border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)`,
            '&:hover': {
              boxShadow: shadows.cardHover,
            },
          },
        },
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius:    radius.xl,
          },
          rounded: {
            borderRadius: radius.xl,
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius:  radius.full,
            fontSize:      '1.2rem',
            fontWeight:    typography.fontWeight.medium,
            height:        '2.4rem',
          },
        },
      },

      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: radius.md,
              fontSize:     '1.4rem',
              '& fieldset': { borderColor: sc.border },
            },
          },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: sc.border },
          },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            fontSize:     '1.2rem',
            borderRadius: radius.base,
            backgroundColor: sc.textPrimary,
            color:           sc.textInverse,
          },
          arrow: { color: sc.textPrimary },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: radius['3xl'],
            boxShadow:    shadows.modal,
          },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: { borderColor: sc.border },
        },
      },

      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-root': {
              fontWeight:      typography.fontWeight.semibold,
              fontSize:        '1.2rem',
              letterSpacing:   '0.05em',
              textTransform:   'uppercase',
              backgroundColor: sc.surfaceElevated,
              color:           sc.textSecondary,
            },
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: {
            fontSize:    '1.4rem',
            borderColor: sc.border,
            padding:     '1.2rem 1.6rem',
          },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: radius.lg,
            fontSize:     '1.4rem',
          },
        },
      },

      MuiBadge: {
        styleOverrides: {
          badge: {
            fontSize:  '1rem',
            minWidth:  '1.8rem',
            height:    '1.8rem',
          },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: radius.full, height: '0.6rem' },
          bar:  { borderRadius: radius.full },
        },
      },

      MuiCircularProgress: {
        defaultProps: { thickness: 3.6 },
      },

      MuiSkeleton: {
        defaultProps: { animation: 'wave' },
        styleOverrides: {
          root: { borderRadius: radius.md },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            transition:   transitions.all,
          },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            transition:   transitions.all,
          },
        },
      },

      MuiSelect: {
        styleOverrides: {
          root: { fontSize: '1.4rem', borderRadius: radius.md },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: { fontSize: '1.4rem', borderRadius: radius.base },
        },
      },

      MuiSwitch: {
        styleOverrides: {
          root:  { padding: '0.8rem' },
          thumb: { boxShadow: shadows.xs },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            fontSize:    '1.4rem',
            fontWeight:  typography.fontWeight.medium,
            textTransform: 'none',
            minHeight:   '4.8rem',
          },
        },
      },

      MuiTabs: {
        styleOverrides: {
          indicator: { height: '2px', borderRadius: radius.full },
        },
      },
    },
  });
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
export const lightTheme = createInmidiaTheme('light');
export const darkTheme  = createInmidiaTheme('dark');

export { createInmidiaTheme };
export default lightTheme;
