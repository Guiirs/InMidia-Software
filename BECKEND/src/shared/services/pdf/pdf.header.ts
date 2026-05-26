/**
 * PDF Service - Header Renderer
 * Renderiza o cabeçalho do documento (tabela de informações)
 */

import fs from 'fs';
import logger from '../../container/logger';
import * as constants from './pdf.constants';
import * as helpers from './pdf.helpers';
import { PDFDocumentInstance, TipoDocumento, EmpresaData, ClienteData, PIData, UserData } from './pdf.types';

export function drawHorizontalHeader(
  doc: PDFDocumentInstance,
  tipoDoc: TipoDocumento,
  docId: string,
  empresa: EmpresaData,
  cliente: ClienteData,
  pi: PIData,
  user: UserData
): number {
  let y = constants.MARGIN;
  
  // Logo e Título
  try {
    if (fs.existsSync(constants.LOGO_PATH)) {
      doc.image(constants.LOGO_PATH, constants.MARGIN, y, { width: 80, height: 40 });
    }
  } catch (err: any) {
    logger.error(`[PdfService] Erro ao carregar logo: ${err.message}`);
  }
  
  const docTitle = tipoDoc === 'PI' ? 'PROPOSTA INTERNA' : 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS';
  doc.fontSize(constants.FONT_SIZE.TITLE).font(constants.FONT_BOLD)
     .text(docTitle, constants.MARGIN + 100, y + 5, { width: 400, align: 'center' });
  
  doc.fontSize(constants.FONT_SIZE.HEADER).font(constants.FONT_REGULAR)
     .text(`Nº: ${docId}`, constants.PAGE_WIDTH - constants.MARGIN - 120, y + 10, { width: 120, align: 'right' });
  
  y += 50;
  
  // === TABELA DE INFORMAÇÕES (HORIZONTAL) ===
  const tableX = constants.MARGIN;
  const tableWidth = constants.PAGE_WIDTH - (constants.MARGIN * 2);
  const colWidth = constants.TABLE_COL_WIDTH;
  
  doc.fontSize(constants.FONT_SIZE.HEADER).font(constants.FONT_BOLD);
  
  // Linha 1: Headers
  doc.rect(tableX, y, tableWidth, constants.ROW_HEIGHT.HEADER).stroke();
  doc.text('AGÊNCIA', tableX + 2, y + 4, { width: colWidth - 4 });
  doc.text('ANUNCIANTE', tableX + colWidth + 2, y + 4, { width: colWidth - 4 });
  doc.text('PRODUTO', tableX + (colWidth * 2) + 2, y + 4, { width: colWidth - 4 });
  doc.text('AUTORIZAÇÃO Nº', tableX + (colWidth * 3) + 2, y + 4, { width: colWidth - 4 });
  y += constants.ROW_HEIGHT.HEADER;
  
  // Linha 2: Dados
  doc.font(constants.FONT_REGULAR).fontSize(constants.FONT_SIZE.HEADER);
  doc.rect(tableX, y, tableWidth, constants.ROW_HEIGHT.DATA).stroke();
  doc.text(empresa.nome || 'N/A', tableX + 2, y + 3, { width: colWidth - 4 });
  doc.text(cliente.nome || 'N/A', tableX + colWidth + 2, y + 3, { width: colWidth - 4 });
  doc.text(pi.produto || 'OUTDOOR', tableX + (colWidth * 2) + 2, y + 3, { width: colWidth - 4 });
  doc.text(docId, tableX + (colWidth * 3) + 2, y + 3, { width: colWidth - 4 });
  y += constants.ROW_HEIGHT.DATA;
  
  // Linha 3: Headers
  doc.font(constants.FONT_BOLD);
  doc.rect(tableX, y, tableWidth, constants.ROW_HEIGHT.HEADER).stroke();
  doc.text('ENDEREÇO', tableX + 2, y + 4, { width: colWidth - 4 });
  doc.text('ENDEREÇO', tableX + colWidth + 2, y + 4, { width: colWidth - 4 });
  doc.text('DATA EMISSÃO', tableX + (colWidth * 2) + 2, y + 4, { width: colWidth - 4 });
  doc.text('PERÍODO', tableX + (colWidth * 3) + 2, y + 4, { width: colWidth - 4 });
  y += constants.ROW_HEIGHT.HEADER;
  
  // Linha 4: Dados - ENDEREÇO COMPLETO
  doc.font(constants.FONT_REGULAR);
  doc.rect(tableX, y, tableWidth, constants.ROW_HEIGHT.DATA).stroke();
  const enderecoEmpresa = helpers.buildFullAddress(empresa.endereco, empresa.bairro, empresa.cidade);
  const enderecoCliente = helpers.buildFullAddress(cliente.endereco, cliente.bairro, cliente.cidade);
  doc.text(enderecoEmpresa, tableX + 2, y + 3, { width: colWidth - 4 });
  doc.text(enderecoCliente, tableX + colWidth + 2, y + 3, { width: colWidth - 4 });
  doc.text(helpers.formatDate(new Date()), tableX + (colWidth * 2) + 2, y + 3, { width: colWidth - 4 });
  doc.text(pi.descricaoPeriodo || pi.tipoPeriodo || 'MENSAL', tableX + (colWidth * 3) + 2, y + 3, { width: colWidth - 4 });
  y += constants.ROW_HEIGHT.DATA;
  
  // Linha 5: Headers - TELEFONES
  doc.font(constants.FONT_BOLD);
  doc.rect(tableX, y, tableWidth, constants.ROW_HEIGHT.HEADER).stroke();
  doc.text('CNPJ / TELEFONE', tableX + 2, y + 4, { width: colWidth - 4 });
  doc.text('CNPJ / TELEFONE', tableX + colWidth + 2, y + 4, { width: colWidth - 4 });
  doc.text('RESPONSÁVEL', tableX + (colWidth * 2) + 2, y + 4, { width: colWidth - 4 });
  doc.text('SEGMENTO', tableX + (colWidth * 3) + 2, y + 4, { width: colWidth - 4 });
  y += constants.ROW_HEIGHT.HEADER;
  
  // Linha 6: Dados - CNPJ e TELEFONES
  doc.font(constants.FONT_REGULAR);
  doc.rect(tableX, y, tableWidth, constants.ROW_HEIGHT.EXTENDED).stroke();
  const empresaInfo = helpers.buildContactInfo(empresa.cnpj, empresa.telefone);
  const clienteInfo = helpers.buildContactInfo(cliente.cnpj, cliente.telefone);
  doc.fontSize(constants.FONT_SIZE.SMALL).text(empresaInfo, tableX + 2, y + 2, { width: colWidth - 4 });
  doc.text(clienteInfo, tableX + colWidth + 2, y + 2, { width: colWidth - 4 });
  doc.fontSize(constants.FONT_SIZE.HEADER).text(cliente.responsavel || 'N/A', tableX + (colWidth * 2) + 2, y + 5, { width: colWidth - 4 });
  doc.text(cliente.segmento || 'N/A', tableX + (colWidth * 3) + 2, y + 5, { width: colWidth - 4 });
  y += constants.ROW_HEIGHT.EXTENDED;
  
  // Linha 7: Headers - ATENDIMENTO E PAGAMENTO
  doc.font(constants.FONT_BOLD);
  doc.rect(tableX, y, tableWidth, constants.ROW_HEIGHT.HEADER).stroke();
  doc.text('CONTATO/ATENDIMENTO', tableX + 2, y + 4, { width: colWidth - 4 });
  doc.text('CONDIÇÕES DE PGTO', tableX + colWidth + 2, y + 4, { width: colWidth - 4 });
  doc.text('DATA INÍCIO', tableX + (colWidth * 2) + 2, y + 4, { width: colWidth - 4 });
  doc.text('DATA FIM', tableX + (colWidth * 3) + 2, y + 4, { width: colWidth - 4 });
  y += constants.ROW_HEIGHT.HEADER;
  
  // Linha 8: Dados - ATENDIMENTO E DATAS
  doc.font(constants.FONT_REGULAR);
  doc.rect(tableX, y, tableWidth, constants.ROW_HEIGHT.DATA).stroke();
  const contatoAtendimento = user ? `${user.nome} ${user.sobrenome || ''}`.trim() : 'Atendimento';
  doc.text(contatoAtendimento, tableX + 2, y + 3, { width: colWidth - 4 });
  doc.text(pi.formaPagamento || 'A combinar', tableX + colWidth + 2, y + 3, { width: colWidth - 4 });
  doc.text(helpers.formatDate(pi.dataInicio), tableX + (colWidth * 2) + 2, y + 3, { width: colWidth - 4 });
  doc.text(helpers.formatDate(pi.dataFim), tableX + (colWidth * 3) + 2, y + 3, { width: colWidth - 4 });
  y += constants.ROW_HEIGHT.EXTENDED;
  
  return y;
}
