/**
 * PDF Service - Constantes
 * Definições de layout, fontes e dimensões
 */

import path from 'path';

// === PATHS ===
export const LOGO_PATH = path.join(__dirname, '..', '..', '..', 'public', 'logo_contrato.png');

// === FONTS ===
export const FONT_REGULAR = 'Helvetica';
export const FONT_BOLD = 'Helvetica-Bold';

// === PAGE DIMENSIONS (A4 Landscape) ===
export const PAGE_WIDTH = 841.89;
export const PAGE_HEIGHT = 595.28;
export const MARGIN = 30;

// === TABLE DIMENSIONS ===
export const TABLE_COL_WIDTH = (PAGE_WIDTH - (MARGIN * 2)) / 4; // 4 colunas
export const PLACA_COL_WIDTH = 80;
export const MAX_DAYS_DISPLAY = 30;

// === FONT SIZES ===
export const FONT_SIZE = {
  TITLE: 14,
  SECTION: 9,
  HEADER: 7,
  BODY: 7,
  SMALL: 6,
  GRID: 8
};

// === ROW HEIGHTS ===
export const ROW_HEIGHT = {
  HEADER: 15,
  DATA: 12,
  EXTENDED: 15,
  PLACA: 25,
  SIGNATURE: 20
};
