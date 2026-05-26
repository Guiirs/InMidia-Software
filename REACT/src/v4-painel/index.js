/* ─── V4 PAINEL — API PÚBLICA ────────────────────────────────── */

/* Entry point principal */
export { default as V4Painel }    from './V4Painel.jsx';
export { default as AppShell }    from './shell/AppShell.jsx';

/* Providers */
export { RuntimeProvider }        from './providers/RuntimeProvider.jsx';
export { OperationalStateProvider, useOperationalState } from './providers/OperationalStateProvider.jsx';
export { V4ThemeProvider, useV4Theme } from './providers/ThemeProvider.jsx';

/* Design System */
export * from './design-system/index.js';

/* Foundation */
export * from './foundation/operationalStates.js';
export * from './foundation/severityLevels.js';
export * from './foundation/priorities.js';
export * from './foundation/navigation.js';
export * from './foundation/layoutSystem.js';
export { LANG } from './foundation/runtimeLanguage.js';
