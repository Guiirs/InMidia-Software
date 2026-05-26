/**
 * Conversor XLSX para PDF
 * Utiliza xlsx-populate para ler Excel e puppeteer para gerar PDF
 */
import * as XlsxPopulate from 'xlsx-populate';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs/promises';
import logger from '../container/logger';

interface ConversionOptions {
    orientation?: 'portrait' | 'landscape';
    format?: 'A4' | 'Letter' | 'A3';
    margin?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
    };
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    scale?: number;
}

/**
 * Tipo para Workbook do xlsx-populate
 */
type XlsxWorkbook = any; // xlsx-populate não tem tipos oficiais

/**
 * Converte um arquivo XLSX para Buffer PDF
 * @param xlsxPath - Caminho do arquivo XLSX
 * @param options - Opções de conversão
 * @returns Buffer do PDF gerado
 */
export async function convertXlsxToPdfBuffer(
    xlsxPath: string, 
    options: ConversionOptions = {}
): Promise<Buffer> {
    logger.info(`[XLSX-to-PDF] Iniciando conversão: ${xlsxPath}`);
    
    let browser: Browser | undefined;
    
    try {
        // 1. Carrega o arquivo Excel
        const workbook: XlsxWorkbook = await XlsxPopulate.fromFileAsync(xlsxPath);
        
        // 2. Converte para HTML
        const html = await convertWorkbookToHtml(workbook, options);
        
        // 3. Usa Puppeteer para gerar PDF do HTML
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        const page: Page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // 4. Gera o PDF
        const pdfBuffer = await page.pdf({
            format: options.format || 'A4',
            landscape: options.orientation === 'landscape',
            printBackground: true,
            margin: options.margin || {
                top: '0.5cm',
                right: '0.5cm',
                bottom: '0.5cm',
                left: '0.5cm'
            },
            displayHeaderFooter: options.displayHeaderFooter || false,
            headerTemplate: options.headerTemplate || '',
            footerTemplate: options.footerTemplate || '',
            scale: options.scale || 1.0
        });
        
        logger.info(`[XLSX-to-PDF] Conversão concluída com sucesso. PDF size: ${pdfBuffer.length} bytes`);
        
        return Buffer.from(pdfBuffer);
        
    } catch (error) {
        const err = error as Error;
        logger.error(`[XLSX-to-PDF] Erro na conversão: ${err.message}`, { stack: err.stack });
        throw new Error(`Falha ao converter XLSX para PDF: ${err.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Converte um Buffer XLSX para PDF
 * @param xlsxBuffer - Buffer do arquivo XLSX
 * @param options - Opções de conversão
 * @returns Buffer do PDF gerado
 */
export async function convertXlsxBufferToPdf(
    xlsxBuffer: Buffer,
    options: ConversionOptions = {}
): Promise<Buffer> {
    logger.info(`[XLSX-to-PDF] Convertendo buffer XLSX para PDF`);
    
    let browser: Browser | undefined;
    
    try {
        // 1. Carrega o workbook do buffer
        const workbook: XlsxWorkbook = await XlsxPopulate.fromDataAsync(xlsxBuffer);
        
        // 2. Converte para HTML
        const html = await convertWorkbookToHtml(workbook, options);
        
        // 3. Usa Puppeteer para gerar PDF
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        const page: Page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // 4. Gera o PDF
        const pdfBuffer = await page.pdf({
            format: options.format || 'A4',
            landscape: options.orientation === 'landscape',
            printBackground: true,
            margin: options.margin || {
                top: '0.5cm',
                right: '0.5cm',
                bottom: '0.5cm',
                left: '0.5cm'
            },
            displayHeaderFooter: options.displayHeaderFooter || false,
            headerTemplate: options.headerTemplate || '',
            footerTemplate: options.footerTemplate || '',
            scale: options.scale || 1.0
        });
        
        logger.info(`[XLSX-to-PDF] Conversão de buffer concluída. PDF size: ${pdfBuffer.length} bytes`);
        
        return Buffer.from(pdfBuffer);
        
    } catch (error) {
        const err = error as Error;
        logger.error(`[XLSX-to-PDF] Erro na conversão de buffer: ${err.message}`, { stack: err.stack });
        throw new Error(`Falha ao converter buffer XLSX para PDF: ${err.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Converte um workbook Excel para HTML estilizado
 */
async function convertWorkbookToHtml(workbook: XlsxWorkbook, options: ConversionOptions): Promise<string> {
    const sheet = workbook.sheet(0); // Primeira aba
    
    // Detecta o range usado
    const usedRange = sheet.usedRange();
    if (!usedRange) {
        return '<html><body><p>Planilha vazia</p></body></html>';
    }
    
    const startRow = usedRange.startCell().rowNumber();
    const endRow = usedRange.endCell().rowNumber();
    const startCol = usedRange.startCell().columnNumber();
    const endCol = usedRange.endCell().columnNumber();
    
    // Constrói a tabela HTML
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        @page {
            size: ${options.orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
            margin: 0;
        }
        
        body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 10pt;
            padding: 5mm;
            width: 100%;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto;
            border: 1px solid #000;
        }
        
        td, th {
            border: 1px solid #999;
            padding: 3px 5px;
            text-align: left;
            vertical-align: middle;
            white-space: nowrap;
            font-size: 9pt;
            min-width: 50px;
        }
        
        th {
            background-color: #e0e0e0;
            font-weight: bold;
        }
        
        .number {
            text-align: right;
        }
        
        .center {
            text-align: center;
        }
        
        .bold {
            font-weight: bold;
        }
        
        .currency {
            text-align: right;
        }
        
        @media print {
            body {
                padding: 0;
            }
            
            table {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <table>
`;
    
    // Itera pelas linhas e colunas
    for (let row = startRow; row <= endRow; row++) {
        html += '        <tr>\n';
        
        for (let col = startCol; col <= endCol; col++) {
            const cell = sheet.cell(row, col);
            let value = cell.value();
            
            // Trata valores
            if (value === undefined || value === null) {
                value = '';
            } else if (typeof value === 'object' && value.formula) {
                value = value.formula;
            } else if (typeof value === 'number') {
                // Formata números
                const style = cell.style('numberFormat');
                if (style && style.includes('$')) {
                    value = formatCurrency(value);
                } else {
                    value = value.toString();
                }
            } else if (value instanceof Date) {
                value = formatDate(value);
            }
            
            // Detecta estilos
            let cellClass = '';
            const bold = cell.style('bold');
            const horizontalAlign = cell.style('horizontalAlignment');
            
            if (bold) cellClass += 'bold ';
            if (horizontalAlign === 'center') cellClass += 'center ';
            if (horizontalAlign === 'right') cellClass += 'number ';
            
            // Background color
            const bgColor = cell.style('fill');
            let styleAttr = '';
            if (bgColor && bgColor.rgb) {
                styleAttr = ` style="background-color: #${bgColor.rgb.substring(2)};"`;
            }
            
            // Merged cells - desabilitado temporariamente (API incompatível)
            // const merged = cell.merged();
            const colspan = '';
            const rowspan = '';
            
            html += `            <td class="${cellClass}"${colspan}${rowspan}${styleAttr}>${escapeHtml(value)}</td>\n`;
        }
        
        html += '        </tr>\n';
    }
    
    html += `
    </table>
</body>
</html>`;
    
    return html;
}

/**
 * Formata número como moeda
 */
function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/**
 * Formata data
 */
function formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Escapa HTML
 */
function escapeHtml(text: any): string {
    const str = String(text);
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m] || m);
}

/**
 * Converte XLSX para PDF e salva em arquivo
 */
export async function convertXlsxToPdfFile(
    xlsxPath: string,
    pdfPath: string,
    options: ConversionOptions = {}
): Promise<void> {
    const buffer = await convertXlsxToPdfBuffer(xlsxPath, options);
    await fs.writeFile(pdfPath, buffer);
    logger.info(`[XLSX-to-PDF] PDF salvo em: ${pdfPath}`);
}

export default {
    convertXlsxToPdfBuffer,
    convertXlsxBufferToPdf,
    convertXlsxToPdfFile
};
