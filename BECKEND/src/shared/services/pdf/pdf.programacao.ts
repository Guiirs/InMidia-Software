/**
 * PDF Service - Programação Table Renderer
 * Renderiza a tabela de programação de placas com grid de dias
 */

import * as constants from './pdf.constants';
import * as helpers from './pdf.helpers';
import { PDFDocumentInstance, PIData, PlacaData } from './pdf.types';

export function drawProgramacaoTable(
  doc: PDFDocumentInstance,
  pi: PIData,
  currentY: number
): number {
  const tableX = constants.MARGIN;
  const tableWidth = constants.PAGE_WIDTH - (constants.MARGIN * 2);
  
  // Título da seção
  doc.fontSize(constants.FONT_SIZE.SECTION).font(constants.FONT_BOLD);
  doc.text('PROGRAMAÇÃO:', tableX, currentY);
  currentY += 15;
  
  // DESCRIÇÃO DA CAMPANHA
  if (pi.descricao) {
    doc.fontSize(constants.FONT_SIZE.HEADER).font(constants.FONT_REGULAR);
    doc.text(`Descrição: ${pi.descricao}`, tableX, currentY, { width: tableWidth });
    currentY += 12;
  }
  
  doc.fontSize(constants.FONT_SIZE.HEADER).font(constants.FONT_REGULAR);
  doc.text('Período de veiculação conforme programação abaixo:', tableX, currentY);
  currentY += 12;
  
  // === GRID DE DIAS (HORIZONTAL) ===
  const dataInicio = typeof pi.dataInicio === 'string' ? pi.dataInicio : pi.dataInicio.toISOString();
  const dataFim = typeof pi.dataFim === 'string' ? pi.dataFim : pi.dataFim.toISOString();
  const dates = helpers.generateDateRange(dataInicio, dataFim);
  const numDays = dates.length;
  
  // Colunas: PLACA + DIAS (máx 30)
  const placaColWidth = constants.PLACA_COL_WIDTH;
  const dayColWidth = (tableWidth - placaColWidth) / Math.min(numDays, constants.MAX_DAYS_DISPLAY);
  
  // Header: PLACA + Dias
  doc.font(constants.FONT_BOLD).fontSize(constants.FONT_SIZE.SMALL);
  doc.rect(tableX, currentY, placaColWidth, 20).stroke();
  doc.text('PLACA', tableX + 2, currentY + 6, { width: placaColWidth - 4, align: 'center' });
  
  // Header dos dias
  let xPos = tableX + placaColWidth;
  dates.forEach((date, idx) => {
    if (idx >= constants.MAX_DAYS_DISPLAY) return;
    doc.rect(xPos, currentY, dayColWidth, 20).stroke();
    doc.text(helpers.formatShortDate(date), xPos + 1, currentY + 6, { 
      width: dayColWidth - 2, 
      align: 'center' 
    });
    xPos += dayColWidth;
  });
  
  currentY += 20;
  
  // === LINHAS DAS PLACAS ===
  if (!pi.placas || pi.placas.length === 0) {
    doc.fontSize(constants.FONT_SIZE.GRID).font(constants.FONT_REGULAR);
    doc.text('Nenhuma placa selecionada.', tableX + 10, currentY);
    return currentY + 20;
  }
  
  doc.font(constants.FONT_REGULAR).fontSize(constants.FONT_SIZE.HEADER);
  
  pi.placas.forEach((placa: PlacaData) => {
    const rowHeight = constants.ROW_HEIGHT.PLACA;
    
    // Verifica quebra de página
    if (!helpers.hasEnoughSpace(currentY, rowHeight, constants.PAGE_HEIGHT, constants.MARGIN)) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: constants.MARGIN });
      currentY = constants.MARGIN;
    }
    
    // Coluna PLACA
    doc.rect(tableX, currentY, placaColWidth, rowHeight).stroke();
    const codigoPlaca = placa.numero_placa || placa.codigo || 'N/A';
    const regiao = placa.regiao?.nome || '';
    doc.fontSize(constants.FONT_SIZE.HEADER).text(`${codigoPlaca}`, tableX + 2, currentY + 3, { width: placaColWidth - 4 });
    doc.fontSize(constants.FONT_SIZE.SMALL).text(regiao, tableX + 2, currentY + 12, { width: placaColWidth - 4 });
    
    // Grid de dias (marcados)
    xPos = tableX + placaColWidth;
    dates.forEach((_date, idx) => {
      if (idx >= constants.MAX_DAYS_DISPLAY) return;
      doc.rect(xPos, currentY, dayColWidth, rowHeight).stroke();
      // Marca com "X" para indicar que a placa está ativa nesse dia
      doc.fontSize(constants.FONT_SIZE.GRID).text('X', xPos + 1, currentY + 8, { 
        width: dayColWidth - 2, 
        align: 'center' 
      });
      xPos += dayColWidth;
    });
    
    currentY += rowHeight;
  });
  
  // RESUMO DE PLACAS
  currentY += 10;
  doc.fontSize(constants.FONT_SIZE.GRID).font(constants.FONT_BOLD);
  doc.text(`TOTAL DE PLACAS: ${pi.placas.length}`, tableX, currentY);
  
  currentY += 15;
  
  return currentY;
}
