/**
 * PDF Service - Totalização Renderer
 * Renderiza observações e valores totais
 */

import * as constants from './pdf.constants';
import * as helpers from './pdf.helpers';
import { PDFDocumentInstance, PIData } from './pdf.types';

export function drawTotalizacao(
  doc: PDFDocumentInstance,
  pi: PIData,
  currentY: number
): number {
  const tableX = constants.MARGIN;
  const tableWidth = constants.PAGE_WIDTH - (constants.MARGIN * 2);
  
  // Observações
  doc.fontSize(constants.FONT_SIZE.GRID).font(constants.FONT_BOLD);
  doc.text('OBSERVAÇÕES:', tableX, currentY);
  currentY += 12;
  
  doc.fontSize(constants.FONT_SIZE.HEADER).font(constants.FONT_REGULAR);
  const obsText = 'Produção a ser paga pelo cliente conforme orçamento fornecido pela empresa responsável pela produção.';
  doc.text(obsText, tableX, currentY, { width: tableWidth * 0.6, align: 'justify' });
  
  // Valores (tabela à direita)
  const valoresX = tableX + (tableWidth * 0.65);
  const valoresWidth = tableWidth * 0.35;
  
  let yValores = currentY;
  
  doc.fontSize(constants.FONT_SIZE.GRID).font(constants.FONT_BOLD);
  
  // Linha: Valor Produção
  doc.rect(valoresX, yValores, valoresWidth, 15).stroke();
  doc.text('VALOR PRODUÇÃO:', valoresX + 5, yValores + 4, { width: valoresWidth * 0.6 });
  doc.text(helpers.formatMoney(pi.valorProducao || 0), valoresX + (valoresWidth * 0.6), yValores + 4, { 
    width: valoresWidth * 0.4 - 5, 
    align: 'right' 
  });
  yValores += 15;
  
  // Linha: Valor Veiculação
  const valorVeiculacao = (pi.valorTotal || 0) - (pi.valorProducao || 0);
  doc.rect(valoresX, yValores, valoresWidth, 15).stroke();
  doc.text('VALOR VEICULAÇÃO:', valoresX + 5, yValores + 4, { width: valoresWidth * 0.6 });
  doc.text(helpers.formatMoney(valorVeiculacao), valoresX + (valoresWidth * 0.6), yValores + 4, { 
    width: valoresWidth * 0.4 - 5, 
    align: 'right' 
  });
  yValores += 15;
  
  // Linha: Valor Total (destaque)
  doc.fontSize(constants.FONT_SIZE.SECTION);
  doc.rect(valoresX, yValores, valoresWidth, 18).stroke();
  doc.text('VALOR TOTAL:', valoresX + 5, yValores + 5, { width: valoresWidth * 0.6 });
  doc.text(helpers.formatMoney(pi.valorTotal || 0), valoresX + (valoresWidth * 0.6), yValores + 5, { 
    width: valoresWidth * 0.4 - 5, 
    align: 'right' 
  });
  yValores += 18;
  
  // Linha: Vencimento
  doc.fontSize(constants.FONT_SIZE.GRID);
  doc.rect(valoresX, yValores, valoresWidth, 15).stroke();
  doc.text('VENCIMENTO:', valoresX + 5, yValores + 4, { width: valoresWidth * 0.6 });
  doc.text(helpers.formatDate(pi.dataFim), valoresX + (valoresWidth * 0.6), yValores + 4, { 
    width: valoresWidth * 0.4 - 5, 
    align: 'right' 
  });
  
  currentY = Math.max(currentY + 60, yValores + 20);
  
  return currentY;
}
