/**
 * Script de Teste - Conversor XLSX para PDF
 * 
 * Testa o conversor com diferentes cenários:
 * 1. Conversão de arquivo simples
 * 2. Conversão de buffer
 * 3. Diferentes opções de formatação
 * 4. Tratamento de erros
 */

import xlsxToPdfConverter from '../src/shared/utils/xlsx-to-pdf.converter';
import * as XlsxPopulate from 'xlsx-populate';
import * as path from 'path';
import * as fs from 'fs/promises';

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createTestExcel(): Promise<Buffer> {
    log('\n📄 Criando Excel de teste...', 'blue');
    
    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0);
    
    // Header
    sheet.cell('A1').value('CONTRATO DE PRESTAÇÃO DE SERVIÇOS').style({ bold: true, fontSize: 14 });
    sheet.range('A1:D1').merged(true);
    
    // Dados do cliente
    sheet.cell('A3').value('Razão Social:').style({ bold: true });
    sheet.cell('B3').value('Empresa Teste Ltda');
    
    sheet.cell('A4').value('Endereço:').style({ bold: true });
    sheet.cell('B4').value('Rua Teste, 123 - São Paulo/SP');
    
    sheet.cell('A5').value('CNPJ:').style({ bold: true });
    sheet.cell('B5').value('12.345.678/0001-90');
    
    // Campanha
    sheet.cell('A7').value('CAMPANHA').style({ bold: true, fontSize: 12 });
    sheet.range('A7:D7').merged(true);
    
    sheet.cell('A8').value('Título:').style({ bold: true });
    sheet.cell('B8').value('Campanha de Verão 2025');
    
    sheet.cell('A9').value('Produto:').style({ bold: true });
    sheet.cell('B9').value('Outdoor Digital');
    
    sheet.cell('A10').value('Período:').style({ bold: true });
    sheet.cell('B10').value('01/01/2025 a 31/01/2025');
    
    // Valores
    sheet.cell('A12').value('VALORES').style({ bold: true, fontSize: 12 });
    sheet.range('A12:D12').merged(true);
    
    sheet.cell('A13').value('Produção:');
    sheet.cell('D13').value(5000).style({ horizontalAlignment: 'right' });
    
    sheet.cell('A14').value('Veiculação:');
    sheet.cell('D14').value(15000).style({ horizontalAlignment: 'right' });
    
    sheet.cell('A15').value('Total:').style({ bold: true });
    sheet.cell('D15').value(20000).style({ bold: true, horizontalAlignment: 'right' });
    
    return await workbook.outputAsync();
}

async function test1_ConvertBuffer() {
    log('\n🧪 Teste 1: Conversão de Buffer Excel', 'yellow');
    
    try {
        const xlsxBuffer = await createTestExcel();
        log(`  ✓ Excel criado: ${xlsxBuffer.length} bytes`, 'green');
        
        const startTime = Date.now();
        const pdfBuffer = await xlsxToPdfConverter.convertXlsxBufferToPdf(xlsxBuffer, {
            orientation: 'portrait',
            format: 'A4',
            margin: {
                top: '1cm',
                right: '1cm',
                bottom: '1cm',
                left: '1cm'
            }
        });
        const duration = Date.now() - startTime;
        
        log(`  ✓ PDF gerado: ${pdfBuffer.length} bytes em ${duration}ms`, 'green');
        
        // Salva para inspeção visual
        const outputPath = path.join(__dirname, 'test-output-buffer.pdf');
        await fs.writeFile(outputPath, pdfBuffer);
        log(`  ✓ PDF salvo em: ${outputPath}`, 'green');
        
        return true;
    } catch (error) {
        log(`  ✗ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function test2_ConvertFile() {
    log('\n🧪 Teste 2: Conversão de Arquivo Excel', 'yellow');
    
    try {
        // Cria arquivo temporário
        const xlsxBuffer = await createTestExcel();
        const tempXlsxPath = path.join(__dirname, 'test-input.xlsx');
        await fs.writeFile(tempXlsxPath, xlsxBuffer);
        log(`  ✓ Excel temporário criado: ${tempXlsxPath}`, 'green');
        
        const outputPath = path.join(__dirname, 'test-output-file.pdf');
        
        const startTime = Date.now();
        await xlsxToPdfConverter.convertXlsxToPdfFile(tempXlsxPath, outputPath, {
            orientation: 'landscape',
            format: 'A4'
        });
        const duration = Date.now() - startTime;
        
        log(`  ✓ PDF gerado em ${duration}ms`, 'green');
        
        const stats = await fs.stat(outputPath);
        log(`  ✓ PDF salvo: ${outputPath} (${stats.size} bytes)`, 'green');
        
        // Limpa arquivo temporário
        await fs.unlink(tempXlsxPath);
        log(`  ✓ Arquivo temporário removido`, 'green');
        
        return true;
    } catch (error) {
        log(`  ✗ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function test3_DifferentFormats() {
    log('\n🧪 Teste 3: Diferentes Formatos e Opções', 'yellow');
    
    const formats: Array<{ name: string; options: any }> = [
        {
            name: 'A4 Portrait com margens pequenas',
            options: { orientation: 'portrait', format: 'A4', margin: { top: '0.5cm', right: '0.5cm', bottom: '0.5cm', left: '0.5cm' } }
        },
        {
            name: 'A4 Landscape',
            options: { orientation: 'landscape', format: 'A4' }
        },
        {
            name: 'Letter Portrait com escala 0.8',
            options: { orientation: 'portrait', format: 'Letter', scale: 0.8 }
        }
    ];
    
    let allPassed = true;
    
    for (const format of formats) {
        try {
            log(`  🔸 Testando: ${format.name}`, 'blue');
            
            const xlsxBuffer = await createTestExcel();
            const startTime = Date.now();
            const pdfBuffer = await xlsxToPdfConverter.convertXlsxBufferToPdf(xlsxBuffer, format.options);
            const duration = Date.now() - startTime;
            
            const outputPath = path.join(__dirname, `test-${format.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
            await fs.writeFile(outputPath, pdfBuffer);
            
            log(`    ✓ Gerado: ${pdfBuffer.length} bytes em ${duration}ms`, 'green');
            log(`    ✓ Salvo: ${outputPath}`, 'green');
        } catch (error) {
            log(`    ✗ Erro: ${error.message}`, 'red');
            allPassed = false;
        }
    }
    
    return allPassed;
}

async function test4_ErrorHandling() {
    log('\n🧪 Teste 4: Tratamento de Erros', 'yellow');
    
    let allPassed = true;
    
    // Teste 4.1: Arquivo não existente
    try {
        log('  🔸 Testando arquivo inexistente...', 'blue');
        await xlsxToPdfConverter.convertXlsxToPdfBuffer('/caminho/inexistente.xlsx');
        log('    ✗ Deveria ter lançado erro', 'red');
        allPassed = false;
    } catch (error) {
        log(`    ✓ Erro capturado corretamente: ${error.message}`, 'green');
    }
    
    // Teste 4.2: Buffer inválido
    try {
        log('  🔸 Testando buffer inválido...', 'blue');
        await xlsxToPdfConverter.convertXlsxBufferToPdf(Buffer.from('dados inválidos'));
        log('    ✗ Deveria ter lançado erro', 'red');
        allPassed = false;
    } catch (error) {
        log(`    ✓ Erro capturado corretamente: ${error.message}`, 'green');
    }
    
    return allPassed;
}

async function test5_TemplateContrato() {
    log('\n🧪 Teste 5: Template Real de Contrato', 'yellow');
    
    try {
        const templatePath = path.join(process.cwd(), 'templates', 'CONTRATO.xlsx');
        
        // Verifica se o template existe
        try {
            await fs.access(templatePath);
            log(`  ✓ Template encontrado: ${templatePath}`, 'green');
        } catch {
            log(`  ⚠ Template não encontrado em: ${templatePath}`, 'yellow');
            log(`    Pulando teste...`, 'yellow');
            return true;
        }
        
        // Carrega e preenche o template
        const workbook = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet = workbook.sheet(0);
        
        // Preenche com dados de teste
        sheet.cell('C3').value('Empresa XYZ Ltda');
        sheet.cell('C4').value('Av. Paulista, 1000 - São Paulo/SP');
        sheet.cell('C5').value('98.765.432/0001-10');
        sheet.cell('B8').value('Campanha Inverno 2025');
        sheet.cell('B9').value('Outdoor + Digital');
        sheet.cell('B10').value('15 dias - 01/07/2025 a 15/07/2025');
        sheet.cell('B13').value('PLACA 001: Av. Paulista\nPLACA 002: Marginal Tietê');
        sheet.cell('F18').value(8500);
        sheet.cell('F19').value(21500);
        sheet.cell('F20').value(30000);
        
        const xlsxBuffer = await workbook.outputAsync();
        log(`  ✓ Template preenchido: ${xlsxBuffer.length} bytes`, 'green');
        
        // Converte para PDF
        const startTime = Date.now();
        const pdfBuffer = await xlsxToPdfConverter.convertXlsxBufferToPdf(xlsxBuffer, {
            orientation: 'portrait',
            format: 'A4',
            margin: {
                top: '1cm',
                right: '1cm',
                bottom: '1cm',
                left: '1cm'
            },
            scale: 0.95
        });
        const duration = Date.now() - startTime;
        
        log(`  ✓ PDF gerado: ${pdfBuffer.length} bytes em ${duration}ms`, 'green');
        
        const outputPath = path.join(__dirname, 'test-contrato-template.pdf');
        await fs.writeFile(outputPath, pdfBuffer);
        log(`  ✓ PDF salvo: ${outputPath}`, 'green');
        
        return true;
    } catch (error) {
        log(`  ✗ Erro: ${error.message}`, 'red');
        console.error(error);
        return false;
    }
}

async function runAllTests() {
    log('\n╔══════════════════════════════════════════╗', 'blue');
    log('║  XLSX to PDF Converter - Test Suite     ║', 'blue');
    log('╚══════════════════════════════════════════╝', 'blue');
    
    const results: Array<{ name: string; passed: boolean }> = [];
    
    results.push({ name: 'Conversão de Buffer', passed: await test1_ConvertBuffer() });
    results.push({ name: 'Conversão de Arquivo', passed: await test2_ConvertFile() });
    results.push({ name: 'Diferentes Formatos', passed: await test3_DifferentFormats() });
    results.push({ name: 'Tratamento de Erros', passed: await test4_ErrorHandling() });
    results.push({ name: 'Template de Contrato', passed: await test5_TemplateContrato() });
    
    // Resumo
    log('\n╔══════════════════════════════════════════╗', 'blue');
    log('║  RESUMO DOS TESTES                       ║', 'blue');
    log('╚══════════════════════════════════════════╝', 'blue');
    
    results.forEach(result => {
        const status = result.passed ? '✓' : '✗';
        const color = result.passed ? 'green' : 'red';
        log(`  ${status} ${result.name}`, color);
    });
    
    const totalPassed = results.filter(r => r.passed).length;
    const totalTests = results.length;
    
    log('\n════════════════════════════════════════════', 'blue');
    log(`  Total: ${totalPassed}/${totalTests} testes passaram`, totalPassed === totalTests ? 'green' : 'red');
    log('════════════════════════════════════════════\n', 'blue');
    
    process.exit(totalPassed === totalTests ? 0 : 1);
}

// Executa os testes
runAllTests().catch(error => {
    log(`\n❌ Erro fatal: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});
