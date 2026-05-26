#!/usr/bin/env ts-node
/**
 * Database Migration Script - Field Standardization (camelCase + Suffix)
 * 
 * PROPÓSITO:
 * Migra campos legados no MongoDB para o novo padrão camelCase com sufixos explícitos.
 * Exemplo: `empresa` → `empresaId`, `cliente` → `clienteId`, `placa` → `placaId`
 * 
 * SEGURANÇA:
 * - Suporta modo --dry-run para simulação sem alterações
 * - Processa documentos em lotes (batch size: 100)
 * - Logs detalhados de progresso
 * - Validação antes de aplicar mudanças
 * 
 * USO:
 * ```bash
 * # Simulação (não grava no banco)
 * npm run migrate:fields -- --dry-run
 * 
 * # Execução real
 * npm run migrate:fields
 * 
 * # Com conexão customizada
 * npm run migrate:fields -- --uri="mongodb://localhost:27017/mydb"
 * ```
 * 
 * @version 1.0.0
 * @author Sistema InMidia
 * @date 2025-11-27
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import * as path from 'path';

// Carrega variáveis de ambiente
config({ path: path.resolve(__dirname, '../.env') });

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const BATCH_SIZE = 100;
const DEFAULT_MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/inmidia';

// Parse argumentos da linha de comando
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const customUri = args.find(arg => arg.startsWith('--uri='))?.split('=')[1];
const MONGO_URI = customUri || DEFAULT_MONGO_URI;

// ============================================================
// CORES PARA LOGS (opcional)
// ============================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// ============================================================
// MAPEAMENTO DE CAMPOS (Legado → Novo)
// ============================================================

interface FieldMapping {
  oldField: string;
  newField: string;
  type: 'ObjectId' | 'String' | 'Date' | 'Array';
  transform?: (value: any) => any;
}

const COLLECTION_MAPPINGS: Record<string, FieldMapping[]> = {
  clientes: [
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'id_empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'empresa_id', newField: 'empresaId', type: 'ObjectId' },
  ],
  aluguels: [  // ← CORRIGIDO: Nome real da coleção no MongoDB
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'cliente', newField: 'clienteId', type: 'ObjectId' },
    { oldField: 'placa', newField: 'placaId', type: 'ObjectId' },
    { oldField: 'id_empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'id_cliente', newField: 'clienteId', type: 'ObjectId' },
    { oldField: 'id_placa', newField: 'placaId', type: 'ObjectId' },
  ],
  placas: [
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'regiao', newField: 'regiaoId', type: 'ObjectId' },
    { oldField: 'id_empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'id_regiao', newField: 'regiaoId', type: 'ObjectId' },
  ],
  regioes: [
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'id_empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'id_regiao', newField: 'regiaoId', type: 'ObjectId' },
  ],
  regiaos: [  // ← CORRIGIDO: Nome real da coleção no MongoDB
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'id_empresa', newField: 'empresaId', type: 'ObjectId' },
  ],
  users: [
    { oldField: 'id_empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'password', newField: 'senha', type: 'String' },
  ],
  propostainternas: [
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'cliente', newField: 'clienteId', type: 'ObjectId' },
    { oldField: 'id_empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'id_cliente', newField: 'clienteId', type: 'ObjectId' },
  ],
  contratos: [
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'cliente', newField: 'clienteId', type: 'ObjectId' },
    { oldField: 'proposta_interna', newField: 'propostaInternaId', type: 'ObjectId' },
  ],
};

// ============================================================
// ESTATÍSTICAS DE MIGRAÇÃO
// ============================================================

interface MigrationStats {
  collection: string;
  totalDocs: number;
  docsToMigrate: number;
  docsMigrated: number;
  errors: number;
  duration: number;
}

const stats: MigrationStats[] = [];

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logProgress(current: number, total: number, collection: string) {
  const percent = ((current / total) * 100).toFixed(1);
  process.stdout.write(
    `${colors.cyan}[${collection}] Processando: ${current}/${total} (${percent}%)${colors.reset}\r`
  );
}

function validateObjectId(value: any): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

// ============================================================
// MIGRAÇÃO DE COLEÇÃO
// ============================================================

async function migrateCollection(collectionName: string, mappings: FieldMapping[]): Promise<MigrationStats> {
  const startTime = Date.now();
  const collectionStats: MigrationStats = {
    collection: collectionName,
    totalDocs: 0,
    docsToMigrate: 0,
    docsMigrated: 0,
    errors: 0,
    duration: 0,
  };

  try {
    log(`\n${'='.repeat(60)}`, 'bright');
    log(`Migrando coleção: ${collectionName}`, 'bright');
    log(`${'='.repeat(60)}`, 'bright');

    const db = mongoose.connection.db;
    if (!db) throw new Error('Conexão com MongoDB não estabelecida');

    const collection = db.collection(collectionName);
    const totalDocs = await collection.countDocuments();
    collectionStats.totalDocs = totalDocs;

    if (totalDocs === 0) {
      log(`⚠️  Coleção vazia, pulando...`, 'yellow');
      return collectionStats;
    }

    log(`📊 Total de documentos: ${totalDocs}`, 'blue');

    // Construir query para encontrar documentos com campos legados
    const orConditions = mappings.map(m => ({ [m.oldField]: { $exists: true } }));
    const docsToMigrate = await collection.countDocuments({ $or: orConditions });
    collectionStats.docsToMigrate = docsToMigrate;

    if (docsToMigrate === 0) {
      log(`✅ Todos os documentos já estão no padrão novo!`, 'green');
      return collectionStats;
    }

    log(`🔄 Documentos para migrar: ${docsToMigrate}`, 'yellow');

    if (isDryRun) {
      log(`\n🔍 MODO DRY-RUN: Nenhuma alteração será feita\n`, 'cyan');
    }

    // Processar em lotes
    let processed = 0;
    let migrated = 0;
    let errors = 0;

    const cursor = collection.find({ $or: orConditions }).batchSize(BATCH_SIZE);

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) continue;

      processed++;
      logProgress(processed, docsToMigrate, collectionName);

      try {
        const updates: any = {};
        const unsets: any = {};
        let hasChanges = false;

        // Para cada mapeamento, verificar se o campo legado existe
        for (const mapping of mappings) {
          const oldValue = doc[mapping.oldField];
          
          if (oldValue !== undefined && oldValue !== null) {
            // Verifica se o novo campo já existe
            const newValue = doc[mapping.newField];
            
            if (newValue === undefined || newValue === null) {
              // Validação e transformação
              let transformedValue = oldValue;
              
              if (mapping.type === 'ObjectId') {
                if (!validateObjectId(oldValue)) {
                  log(`\n⚠️  ObjectId inválido em ${collectionName}._id=${doc._id}, campo=${mapping.oldField}`, 'yellow');
                  continue;
                }
                transformedValue = new mongoose.Types.ObjectId(oldValue);
              } else if (mapping.type === 'Date' && typeof oldValue === 'string') {
                transformedValue = new Date(oldValue);
              } else if (mapping.transform) {
                transformedValue = mapping.transform(oldValue);
              }

              updates[mapping.newField] = transformedValue;
              unsets[mapping.oldField] = '';
              hasChanges = true;
            } else {
              // Novo campo já existe, apenas remove o antigo
              unsets[mapping.oldField] = '';
              hasChanges = true;
            }
          }
        }

        if (hasChanges && !isDryRun) {
          const updateOp: any = {};
          if (Object.keys(updates).length > 0) updateOp.$set = updates;
          if (Object.keys(unsets).length > 0) updateOp.$unset = unsets;

          await collection.updateOne({ _id: doc._id }, updateOp);
          migrated++;
        } else if (hasChanges && isDryRun) {
          migrated++;
          if (migrated <= 5) {
            // Mostra os primeiros 5 exemplos no dry-run
            log(`\n📝 [DRY-RUN] Documento ${doc._id}:`, 'dim');
            if (Object.keys(updates).length > 0) {
              log(`   $set: ${JSON.stringify(updates, null, 2)}`, 'dim');
            }
            if (Object.keys(unsets).length > 0) {
              log(`   $unset: ${JSON.stringify(Object.keys(unsets))}`, 'dim');
            }
          }
        }
      } catch (err: any) {
        errors++;
        log(`\n❌ Erro ao migrar documento ${doc._id}: ${err.message}`, 'red');
      }
    }

    process.stdout.write('\n'); // Limpa a linha de progresso

    collectionStats.docsMigrated = migrated;
    collectionStats.errors = errors;
    collectionStats.duration = Date.now() - startTime;

    // Resumo da coleção
    log(`\n✅ Migração concluída:`, 'green');
    log(`   - Documentos processados: ${processed}`, 'green');
    log(`   - Documentos ${isDryRun ? 'simulados' : 'migrados'}: ${migrated}`, 'green');
    if (errors > 0) {
      log(`   - Erros: ${errors}`, 'red');
    }
    log(`   - Duração: ${(collectionStats.duration / 1000).toFixed(2)}s`, 'blue');

  } catch (err: any) {
    log(`\n❌ Erro fatal na coleção ${collectionName}: ${err.message}`, 'red');
    collectionStats.errors++;
  }

  return collectionStats;
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

async function main() {
  log('\n' + '='.repeat(80), 'bright');
  log('🚀 DATABASE MIGRATION - Field Standardization (camelCase + Suffix)', 'bright');
  log('='.repeat(80) + '\n', 'bright');

  log(`📋 Configuração:`, 'cyan');
  log(`   - MongoDB URI: ${MONGO_URI}`, 'dim');
  log(`   - Modo: ${isDryRun ? 'DRY-RUN (simulação)' : 'PRODUÇÃO (grava no banco)'}`, isDryRun ? 'yellow' : 'red');
  log(`   - Batch Size: ${BATCH_SIZE}`, 'dim');
  log(`   - Coleções: ${Object.keys(COLLECTION_MAPPINGS).join(', ')}\n`, 'dim');

  if (!isDryRun) {
    log(`⚠️  ATENÇÃO: Esta operação modificará dados no banco!`, 'yellow');
    log(`   Execute com --dry-run primeiro para validar.\n`, 'yellow');
    
    // Aguarda 3 segundos para dar tempo de cancelar (Ctrl+C)
    log(`   Iniciando em 3 segundos... (Ctrl+C para cancelar)`, 'red');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  try {
    // Conectar ao MongoDB
    log(`🔌 Conectando ao MongoDB...`, 'cyan');
    await mongoose.connect(MONGO_URI);
    log(`✅ Conectado com sucesso!\n`, 'green');

    // Migrar cada coleção
    for (const [collectionName, mappings] of Object.entries(COLLECTION_MAPPINGS)) {
      const collectionStats = await migrateCollection(collectionName, mappings);
      stats.push(collectionStats);
    }

    // Relatório Final
    log('\n' + '='.repeat(80), 'bright');
    log('📊 RELATÓRIO FINAL DE MIGRAÇÃO', 'bright');
    log('='.repeat(80), 'bright');

    let totalDocs = 0;
    let totalMigrated = 0;
    let totalErrors = 0;
    let totalDuration = 0;

    stats.forEach(stat => {
      totalDocs += stat.totalDocs;
      totalMigrated += stat.docsMigrated;
      totalErrors += stat.errors;
      totalDuration += stat.duration;

      log(`\n📁 ${stat.collection}:`, 'cyan');
      log(`   - Total: ${stat.totalDocs}`, 'dim');
      log(`   - Necessitavam migração: ${stat.docsToMigrate}`, 'dim');
      log(`   - ${isDryRun ? 'Simulados' : 'Migrados'}: ${stat.docsMigrated}`, stat.docsMigrated > 0 ? 'green' : 'dim');
      if (stat.errors > 0) {
        log(`   - Erros: ${stat.errors}`, 'red');
      }
    });

    log(`\n${'='.repeat(80)}`, 'bright');
    log(`📈 TOTAIS GERAIS:`, 'bright');
    log(`   - Documentos totais: ${totalDocs}`, 'cyan');
    log(`   - Documentos ${isDryRun ? 'simulados' : 'migrados'}: ${totalMigrated}`, totalMigrated > 0 ? 'green' : 'dim');
    if (totalErrors > 0) {
      log(`   - Erros: ${totalErrors}`, 'red');
    }
    log(`   - Duração total: ${(totalDuration / 1000).toFixed(2)}s`, 'blue');
    log('='.repeat(80) + '\n', 'bright');

    if (isDryRun) {
      log(`✅ Simulação concluída! Execute sem --dry-run para aplicar as mudanças.`, 'green');
    } else {
      log(`✅ Migração concluída com sucesso!`, 'green');
    }

  } catch (err: any) {
    log(`\n❌ Erro fatal: ${err.message}`, 'red');
    if (err.stack) {
      log(err.stack, 'dim');
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log(`\n🔌 Desconectado do MongoDB.`, 'cyan');
  }
}

// ============================================================
// EXECUÇÃO
// ============================================================

main()
  .then(() => {
    log(`\n✅ Script finalizado.\n`, 'green');
    process.exit(0);
  })
  .catch((err) => {
    log(`\n❌ Erro não tratado: ${err.message}\n`, 'red');
    process.exit(1);
  });
