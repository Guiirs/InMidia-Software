// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
/**
 * PI Sync Service
 * Sincronização de propostas internas
 */
// src/modules/propostas-internas/pi-sync.service.ts
import PropostaInterna from './PropostaInterna';
import Aluguel from '../alugueis/Aluguel';
import logger from '../../shared/container/logger';

class PISyncService {

    /**
     * Valida e sincroniza PIs com seus aluguéis
     * Roda automaticamente a cada 30 minutos
     */
    static async syncPIsWithAlugueis() {
        logger.info(`[PISyncService] 🔄 Iniciando validação PI ↔ Aluguéis...`);
        
        try {
            const pisAtivas = await PropostaInterna.find({
                status: { $in: ['em_andamento', 'concluida'] }
            }).lean();

            if (pisAtivas.length === 0) {
                logger.info(`[PISyncService] ✅ Nenhuma PI ativa para validar.`);
                return;
            }

            logger.info(`[PISyncService] 📊 Validando ${pisAtivas.length} PIs ativas...`);

            let pisComProblemas = 0;
            let alugueisCorrigidos = 0;
            let alugueisOrfaosRemovidos = 0;
            let alugueisCriados = 0;

            for (const pi of pisAtivas) {
                try {
                    const resultado = await this._validatePI(pi);
                    
                    if (resultado.temProblema) {
                        pisComProblemas++;
                        alugueisCorrigidos += resultado.alugueisCorrigidos || 0;
                        alugueisCriados += resultado.alugueisCriados || 0;
                        alugueisOrfaosRemovidos += resultado.alugueisOrfaosRemovidos || 0;
                    }
                } catch (error) {
                    logger.error(`[PISyncService] ❌ Erro ao validar PI ${pi._id}: ${error.message}`);
                }
            }

            logger.info(`[PISyncService] ✅ Validação concluída!`);
            logger.info(`[PISyncService] 📊 Estatísticas:`);
            logger.info(`[PISyncService]    - PIs com problemas: ${pisComProblemas}`);
            logger.info(`[PISyncService]    - Aluguéis criados: ${alugueisCriados}`);
            logger.info(`[PISyncService]    - Aluguéis corrigidos: ${alugueisCorrigidos}`);
            logger.info(`[PISyncService]    - Aluguéis órfãos removidos: ${alugueisOrfaosRemovidos}`);

        } catch (error) {
            logger.error(`[PISyncService] ❌ Erro na validação geral: ${error.message}`, { stack: error.stack });
        }
    }

    /**
     * Valida uma PI específica e corrige inconsistências
     */
    static async _validatePI(pi) {
        const resultado = {
            temProblema: false,
            alugueisCorrigidos: 0,
            alugueisCriados: 0,
            alugueisOrfaosRemovidos: 0,
            problemas: []
        };

        // 1. Buscar aluguéis vinculados a esta PI pelo pi_code
        const alugueisDaPI = await Aluguel.find({
            pi_code: pi.pi_code
        }).lean();

        // 2. Verificar se a quantidade de aluguéis bate com a quantidade de placas
        const placasEsperadas = pi.placas?.length || 0;
        const alugueisEncontrados = alugueisDaPI.length;

        if (alugueisEncontrados !== placasEsperadas) {
            resultado.temProblema = true;
            resultado.problemas.push(`Divergência: ${placasEsperadas} placas na PI, mas ${alugueisEncontrados} aluguéis encontrados`);
            
            logger.warn(`[PISyncService] ⚠️  PI ${pi._id} (${pi.pi_code}): ${placasEsperadas} placas, ${alugueisEncontrados} aluguéis`);

            // Corrigir: criar aluguéis faltantes
            if (alugueisEncontrados < placasEsperadas) {
                const placasComAluguel = alugueisDaPI.map(a => a.placa.toString());
                const placasSemAluguel = pi.placas.filter(p => !placasComAluguel.includes(p.toString()));

                if (placasSemAluguel.length > 0) {
                    logger.info(`[PISyncService] 🔧 Criando ${placasSemAluguel.length} aluguéis faltantes para PI ${pi._id}`);
                    
                    const novosAlugueis = placasSemAluguel.map(placaId => ({
                        placa: placaId,
                        cliente: pi.cliente,
                        empresa: pi.empresa,
                        data_inicio: pi.dataInicio,
                        data_fim: pi.dataFim,
                        pi_code: pi.pi_code,
                        proposta_interna: pi._id,
                        tipo: 'pi'
                    }));

                    await Aluguel.insertMany(novosAlugueis);
                    resultado.alugueisCriados = novosAlugueis.length;
                    logger.info(`[PISyncService] ✅ ${novosAlugueis.length} aluguéis criados`);
                }
            }

            // Corrigir: remover aluguéis órfãos (placas que não estão mais na PI)
            if (alugueisEncontrados > placasEsperadas) {
                const placasNaPI = pi.placas.map(p => p.toString());
                const alugueisOrfaos = alugueisDaPI.filter(a => !placasNaPI.includes(a.placa.toString()));

                if (alugueisOrfaos.length > 0) {
                    logger.info(`[PISyncService] 🔧 Removendo ${alugueisOrfaos.length} aluguéis órfãos da PI ${pi._id}`);
                    
                    const idsOrfaos = alugueisOrfaos.map(a => a._id);
                    await Aluguel.deleteMany({ _id: { $in: idsOrfaos } });
                    resultado.alugueisOrfaosRemovidos = alugueisOrfaos.length;
                    logger.info(`[PISyncService] ✅ ${alugueisOrfaos.length} aluguéis órfãos removidos`);
                }
            }
        }

        // 3. Verificar se as datas dos aluguéis batem com a PI
        const alugueisComDataIncorreta = alugueisDaPI.filter(a => {
            const dataInicioOk = new Date(a.data_inicio).getTime() === new Date(pi.dataInicio).getTime();
            const dataFimOk = new Date(a.data_fim).getTime() === new Date(pi.dataFim).getTime();
            return !dataInicioOk || !dataFimOk;
        });

        if (alugueisComDataIncorreta.length > 0) {
            resultado.temProblema = true;
            resultado.problemas.push(`${alugueisComDataIncorreta.length} aluguéis com datas incorretas`);
            
            logger.warn(`[PISyncService] ⚠️  PI ${pi._id} (${pi.pi_code}): ${alugueisComDataIncorreta.length} aluguéis com datas incorretas`);
            logger.info(`[PISyncService] 🔧 Corrigindo datas dos aluguéis...`);

            await Aluguel.updateMany(
                { pi_code: pi.pi_code },
                {
                    $set: {
                        data_inicio: pi.dataInicio,
                        data_fim: pi.dataFim
                    }
                }
            );
            resultado.alugueisCorrigidos = alugueisComDataIncorreta.length;
            logger.info(`[PISyncService] ✅ ${alugueisComDataIncorreta.length} datas corrigidas`);
        }

        // 4. Verificar se os campos cliente e empresa batem
        const alugueisComClienteIncorreto = alugueisDaPI.filter(a => 
            a.cliente.toString() !== pi.cliente.toString() || 
            a.empresa.toString() !== pi.empresa.toString()
        );

        if (alugueisComClienteIncorreto.length > 0) {
            resultado.temProblema = true;
            resultado.problemas.push(`${alugueisComClienteIncorreto.length} aluguéis com cliente/empresa incorretos`);
            
            logger.warn(`[PISyncService] ⚠️  PI ${pi._id} (${pi.pi_code}): ${alugueisComClienteIncorreto.length} aluguéis com cliente/empresa incorretos`);
            logger.info(`[PISyncService] 🔧 Corrigindo cliente/empresa dos aluguéis...`);

            await Aluguel.updateMany(
                { pi_code: pi.pi_code },
                {
                    $set: {
                        cliente: pi.cliente,
                        empresa: pi.empresa
                    }
                }
            );
            resultado.alugueisCorrigidos += alugueisComClienteIncorreto.length;
            logger.info(`[PISyncService] ✅ ${alugueisComClienteIncorreto.length} registros corrigidos`);
        }

        if (resultado.temProblema) {
            logger.info(`[PISyncService] 📝 PI ${pi._id} (${pi.pi_code}) - Problemas encontrados e corrigidos:`);
            resultado.problemas.forEach(p => logger.info(`[PISyncService]    - ${p}`));
        }

        return resultado;
    }

    /**
     * Remove aluguéis órfãos (sem PI correspondente)
     */
    static async cleanOrphanAlugueis() {
        logger.info(`[PISyncService] 🧹 Limpando aluguéis órfãos...`);

        try {
            // Buscar todos os aluguéis tipo 'pi'
            const alugueisPI = await Aluguel.find({ tipo: 'pi' }).lean();

            if (alugueisPI.length === 0) {
                logger.info(`[PISyncService] ✅ Nenhum aluguel de PI para validar.`);
                return;
            }

            logger.info(`[PISyncService] 📊 Verificando ${alugueisPI.length} aluguéis de PIs...`);

            const orfaos = [];

            for (const aluguel of alugueisPI) {
                // Verificar se a PI existe
                const piExiste = await PropostaInterna.exists({ pi_code: aluguel.pi_code });

                if (!piExiste) {
                    orfaos.push(aluguel._id);
                    logger.warn(`[PISyncService] ⚠️  Aluguel órfão encontrado: ${aluguel._id} (pi_code: ${aluguel.pi_code}) - PI não existe`);
                }
            }

            if (orfaos.length > 0) {
                await Aluguel.deleteMany({ _id: { $in: orfaos } });
                logger.info(`[PISyncService] ✅ ${orfaos.length} aluguéis órfãos removidos`);
            } else {
                logger.info(`[PISyncService] ✅ Nenhum aluguel órfão encontrado`);
            }

        } catch (error) {
            logger.error(`[PISyncService] ❌ Erro ao limpar aluguéis órfãos: ${error.message}`, { stack: error.stack });
        }
    }
}

export default PISyncService;

