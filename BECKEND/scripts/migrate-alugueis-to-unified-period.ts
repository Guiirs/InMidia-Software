/**
 * Script de Migração: Aluguéis Legacy → Sistema Unificado de Períodos
 * 
 * OBJETIVO:
 * Migra aluguéis criados no sistema v1.0 (usando data_inicio, data_fim, bi_week_ids)
 * para o sistema unificado v2.0 (usando startDate, endDate, biWeekIds, periodType).
 * 
 * SEGURANÇA:
 * - Não remove campos legados (mantidos para rollback)
 * - Apenas adiciona/atualiza campos novos
 * - Transacional (rollback automático em caso de erro)
 * - Dry-run mode disponível
 * 
 * USO:
 * npm run migrate:alugueis          # Executa migração
 * npm run migrate:alugueis --dry    # Apenas exibe o que seria migrado
 * npm run migrate:alugueis --limit 100  # Migra apenas 100 documentos
 * 
 * @since 2.0.0
 */

import mongoose from 'mongoose';
import Aluguel from '../src/models/Aluguel';
import { PeriodType } from '../src/utils/periodTypes';
import logger from '../src/config/logger';

// Configuração
const DRY_RUN = process.argv.includes('--dry') || process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0') || 0;
const BATCH_SIZE = 100;

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  details: {
    biWeekType: number;
    customType: number;
    alreadyMigrated: number;
  };
}

/**
 * Determina o tipo de período baseado nos campos legados
 */
function determinePeriodType(aluguel: any): PeriodType {
  if (aluguel.bi_week_ids && aluguel.bi_week_ids.length > 0) {
    return PeriodType.BI_WEEK;
  }
  return PeriodType.CUSTOM;
}

/**
 * Verifica se o aluguel já foi migrado
 */
function isAlreadyMigrated(aluguel: any): boolean {
  return !!(aluguel.startDate && aluguel.endDate && aluguel.periodType);
}

/**
 * Migra um único documento
 */
async function migrateDocument(aluguel: any, session: mongoose.ClientSession | null): Promise<boolean> {
  try {
    // Verifica se já foi migrado
    if (isAlreadyMigrated(aluguel)) {
      logger.debug(`[Migration] Aluguel ${aluguel._id} já migrado. Pulando.`);
      return false;
    }

    // Verifica se tem os campos legados necessários
    if (!aluguel.data_inicio || !aluguel.data_fim) {
      logger.warn(`[Migration] Aluguel ${aluguel._id} não tem data_inicio/data_fim. Pulando.`);
      return false;
    }

    // Determina o tipo de período
    const periodType = determinePeriodType(aluguel);

    // Prepara update
    const updateData: any = {
      periodType: periodType,
      startDate: aluguel.data_inicio,
      endDate: aluguel.data_fim,
    };

    // Se tem bi_week_ids, copia para biWeekIds
    if (aluguel.bi_week_ids && aluguel.bi_week_ids.length > 0) {
      updateData.biWeekIds = aluguel.bi_week_ids;
    }

    // Se tem bi_weeks (ObjectIds), copia para biWeeks
    if (aluguel.bi_weeks && aluguel.bi_weeks.length > 0) {
      updateData.biWeeks = aluguel.bi_weeks;
    }

    if (DRY_RUN) {
      logger.info(`[Migration] [DRY-RUN] Aluguel ${aluguel._id}:`, {
        periodType: updateData.periodType,
        startDate: updateData.startDate,
        endDate: updateData.endDate,
        biWeekIds: updateData.biWeekIds || [],
      });
      return true;
    }

    // Executa update
    const updateOptions = session ? { session } : {};
    await Aluguel.updateOne(
      { _id: aluguel._id },
      { $set: updateData },
      updateOptions
    );

    logger.debug(`[Migration] Aluguel ${aluguel._id} migrado com sucesso.`);
    return true;

  } catch (error: any) {
    logger.error(`[Migration] Erro ao migrar aluguel ${aluguel._id}: ${error.message}`);
    throw error;
  }
}

/**
 * Migra um lote de documentos
 */
async function migrateBatch(
  alugueis: any[],
  session: mongoose.ClientSession | null,
  stats: MigrationStats
): Promise<void> {
  for (const aluguel of alugueis) {
    try {
      if (isAlreadyMigrated(aluguel)) {
        stats.skipped++;
        stats.details.alreadyMigrated++;
        continue;
      }

      const migrated = await migrateDocument(aluguel, session);

      if (migrated) {
        stats.migrated++;
        const periodType = determinePeriodType(aluguel);
        if (periodType === PeriodType.BI_WEEK) {
          stats.details.biWeekType++;
        } else {
          stats.details.customType++;
        }
      } else {
        stats.skipped++;
      }

    } catch (error: any) {
      stats.errors++;
      logger.error(`[Migration] Erro ao processar aluguel ${aluguel._id}: ${error.message}`);
      
      // Em caso de erro, aborta o lote inteiro (rollback da transação)
      if (session) {
        throw error;
      }
    }
  }
}

/**
 * Função principal de migração
 */
async function migrate() {
  const startTime = Date.now();

  logger.info('========================================');
  logger.info('[Migration] Iniciando migração de aluguéis');
  logger.info(`[Migration] Modo: ${DRY_RUN ? 'DRY-RUN (não altera dados)' : 'PRODUÇÃO'}`);
  if (LIMIT > 0) {
    logger.info(`[Migration] Limite: ${LIMIT} documentos`);
  }
  logger.info('========================================');

  try {
    // Conecta ao MongoDB
    if (!mongoose.connection.readyState) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/seu_banco';
      await mongoose.connect(mongoUri);
      logger.info('[Migration] Conectado ao MongoDB');
    }

    // Busca aluguéis que precisam ser migrados
    const query = {
      $or: [
        { startDate: { $exists: false } },
        { endDate: { $exists: false } },
        { periodType: { $exists: false } },
      ],
    };

    const totalToMigrate = await Aluguel.countDocuments(query);
    logger.info(`[Migration] Total de aluguéis a migrar: ${totalToMigrate}`);

    if (totalToMigrate === 0) {
      logger.info('[Migration] Nenhum aluguel necessita migração. Sistema já está atualizado!');
      return;
    }

    const stats: MigrationStats = {
      total: totalToMigrate,
      migrated: 0,
      skipped: 0,
      errors: 0,
      details: {
        biWeekType: 0,
        customType: 0,
        alreadyMigrated: 0,
      },
    };

    // Processa em lotes
    const limit = LIMIT > 0 ? Math.min(LIMIT, totalToMigrate) : totalToMigrate;
    let processed = 0;

    while (processed < limit) {
      const batchSize = Math.min(BATCH_SIZE, limit - processed);
      
      logger.info(`[Migration] Processando lote ${Math.floor(processed / BATCH_SIZE) + 1} (${processed + 1}-${processed + batchSize})...`);

      const alugueis = await Aluguel.find(query)
        .limit(batchSize)
        .lean()
        .exec();

      if (alugueis.length === 0) break;

      // Inicia transação (apenas em modo produção)
      let session: mongoose.ClientSession | null = null;
      if (!DRY_RUN) {
        session = await mongoose.startSession();
        session.startTransaction();
      }

      try {
        await migrateBatch(alugueis, session, stats);

        // Commita transação
        if (session) {
          await session.commitTransaction();
          logger.info(`[Migration] Lote commitado com sucesso.`);
        }

      } catch (error: any) {
        // Rollback em caso de erro
        if (session && session.inTransaction()) {
          await session.abortTransaction();
          logger.error(`[Migration] Transação abortada devido a erro: ${error.message}`);
        }
        throw error;

      } finally {
        if (session) {
          await session.endSession();
        }
      }

      processed += alugueis.length;

      // Progress
      const progress = ((processed / limit) * 100).toFixed(2);
      logger.info(`[Migration] Progresso: ${progress}% (${processed}/${limit})`);
    }

    // Estatísticas finais
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info('========================================');
    logger.info('[Migration] Migração concluída!');
    logger.info(`[Migration] Tempo total: ${duration}s`);
    logger.info('[Migration] Estatísticas:');
    logger.info(`  - Total processado: ${processed}`);
    logger.info(`  - Migrados: ${stats.migrated}`);
    logger.info(`  - Pulados: ${stats.skipped}`);
    logger.info(`  - Erros: ${stats.errors}`);
    logger.info('[Migration] Detalhes:');
    logger.info(`  - Tipo bi-week: ${stats.details.biWeekType}`);
    logger.info(`  - Tipo custom: ${stats.details.customType}`);
    logger.info(`  - Já migrados: ${stats.details.alreadyMigrated}`);
    logger.info('========================================');

  } catch (error: any) {
    logger.error(`[Migration] Erro fatal na migração: ${error.message}`, {
      stack: error.stack,
    });
    throw error;

  } finally {
    // Desconecta
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
      logger.info('[Migration] Desconectado do MongoDB');
    }
  }
}

// Executa migração
if (require.main === module) {
  migrate()
    .then(() => {
      logger.info('[Migration] Script finalizado com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Migration] Script finalizado com erro', error);
      process.exit(1);
    });
}

export default migrate;
