/**
 * Placa Service (OLD)
 * DEPRECADO: Use services/placa.service.ts
 */
// src/services/placa.service.ts
import Placa from './Placa';
import Regiao from '@modules/regioes/Regiao';
import Aluguel from '@modules/alugueis/Aluguel';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import logger from '@shared/container/logger';
const path = require('path');
import mongoose from 'mongoose';
import { safeDeleteFromR2 } from '@shared/infra/http/middlewares/upload.middleware';
import AppError from '@shared/container/AppError';
import cacheService from '@shared/container/cache.service';

const COMMERCIAL_PLATE_FIELDS = [
  'cliente',
  'clienteId',
  'contrato',
  'contratoId',
  'aluguel',
  'aluguelId',
  'valor',
  'valor_mensal',
  'valorMensal',
  'dataInicio',
  'dataFim',
  'data_inicio',
  'data_fim',
  'startDate',
  'endDate',
];

function stripCommercialPlateFields(data: any): any {
  const sanitized = { ...(data || {}) };
  COMMERCIAL_PLATE_FIELDS.forEach((field) => delete sanitized[field]);
  return sanitized;
}

export class PlacaService {
  async createPlaca(placaData: any, file: any, empresaId: string): Promise<any> {
    logger.info(`[PlacaService] Tentando criar placa para empresa ${empresaId}.`);

    if (!placaData.numero_placa || !placaData.regiao) {
        throw new AppError('Número da placa e região são obrigatórios.', 400);
    }

    const dadosParaSalvar = { ...stripCommercialPlateFields(placaData), empresaId: empresaId };

    if (file) {
        logger.info(`[PlacaService] Ficheiro recebido: ${file.key}`);
        dadosParaSalvar.imagem = path.basename(file.key); 
    } else {
        delete dadosParaSalvar.imagem; 
    }

    try {
        // Validação de região (garante que existe e pertence à empresa)
        logger.debug(`[PlacaService] Validando região ID ${dadosParaSalvar.regiaoId || dadosParaSalvar.regiao} para empresa ${empresaId}.`);
        const regiaoExistente = await Regiao.findOne({ _id: dadosParaSalvar.regiaoId || dadosParaSalvar.regiao, empresaId: empresaId }).lean();
        if (!regiaoExistente) {
            throw new AppError(`Região ID ${dadosParaSalvar.regiaoId || dadosParaSalvar.regiao} inválida ou não pertence à empresa ${empresaId}.`, 404);
        }
        logger.debug(`[PlacaService] Região ${regiaoExistente.nome} (ID: ${dadosParaSalvar.regiaoId || dadosParaSalvar.regiao}) validada.`);
        
        // Normalizar para regiaoId
        if (dadosParaSalvar.regiao && !dadosParaSalvar.regiaoId) {
            dadosParaSalvar.regiaoId = dadosParaSalvar.regiao;
            delete dadosParaSalvar.regiao;
        }

        const novaPlaca = new Placa(dadosParaSalvar);

        logger.debug(`[PlacaService] Tentando salvar nova placa ${dadosParaSalvar.numero_placa} no DB.`);
        const placaSalva = await novaPlaca.save();
        logger.info(`[PlacaService] Placa ${placaSalva.numero_placa} (ID: ${placaSalva._id}) criada com sucesso para empresa ${empresaId}.`);

        await placaSalva.populate('regiaoId', 'nome'); // ✅ Padronizado

        return placaSalva.toJSON(); 

    } catch (error) {
        const err = error as any;
        logger.error(`[PlacaService] Erro Mongoose/DB ao criar placa: ${err.message}`, { stack: err.stack, code: err.code, keyValue: err.keyValue });

        if (err.code === 11000) {
            throw new AppError(`Já existe uma placa com o número '${placaData.numero_placa}' nesta região.`, 409);
        }
        if (error instanceof AppError) throw error;
        throw new AppError(`Erro interno ao criar placa: ${err.message}`, 500);
    }
  }

  async updatePlaca(id: string, placaData: any, file: any, empresaId: string): Promise<any> {
    logger.info(`[PlacaService] Tentando atualizar placa ID ${id} para empresa ${empresaId}.`);

    let placaAntiga;
    try {
        placaAntiga = await Placa.findOne({ _id: id, empresaId: empresaId });
        if (!placaAntiga) {
            throw new AppError('Placa não encontrada.', 404);
        }
    } catch (error) {
        if (error instanceof AppError) throw error;
        const err = error as any;
        logger.error(`[PlacaService] Erro Mongoose/DB ao buscar placa antiga ID ${id}: ${err.message}`, { stack: err.stack });
        throw new AppError(`Erro interno ao buscar placa para atualização: ${err.message}`, 500);
    }

    const dadosParaAtualizar = stripCommercialPlateFields(placaData);
    let imagemAntigaKeyCompleta = null; 

    // Lógica para tratar a imagem
    if (file) {
        imagemAntigaKeyCompleta = placaAntiga.imagem ? `${process.env.R2_FOLDER_NAME || 'inmidia-uploads-sistema'}/${placaAntiga.imagem}` : null;
        dadosParaAtualizar.imagem = path.basename(file.key);
    } else if (dadosParaAtualizar.hasOwnProperty('imagem') && dadosParaAtualizar.imagem === '') {
        imagemAntigaKeyCompleta = placaAntiga.imagem ? `${process.env.R2_FOLDER_NAME || 'inmidia-uploads-sistema'}/${placaAntiga.imagem}` : null;
        dadosParaAtualizar.imagem = null; 
    } else {
        delete dadosParaAtualizar.imagem; 
    }

    try {
        // Validação de região (se foi alterada)
        if (dadosParaAtualizar.regiao && String(dadosParaAtualizar.regiao) !== String(placaAntiga.regiao)) {
             const regiaoExistente = await Regiao.findOne({ _id: dadosParaAtualizar.regiao, empresa: empresaId }).lean();
             if (!regiaoExistente) {
                throw new AppError(`Região ID ${dadosParaAtualizar.regiao} inválida ou não pertence à empresa ${empresaId}.`, 404);
             }
        } else if (dadosParaAtualizar.hasOwnProperty('regiao') && !dadosParaAtualizar.regiao) {
             dadosParaAtualizar.regiao = null;
        } else if (!dadosParaAtualizar.hasOwnProperty('regiao')) {
            delete dadosParaAtualizar.regiao;
        }

        const placaAtualizadaDoc = await Placa.findByIdAndUpdate(id, dadosParaAtualizar, { new: true, runValidators: true }).populate('regiaoId', 'nome'); // ✅ Padronizado 
        
        if (!placaAtualizadaDoc) {
             throw new AppError('Placa não encontrada durante a atualização.', 404);
        }
        logger.info(`[PlacaService] Placa ID ${id} atualizada com sucesso no DB.`);

        if (imagemAntigaKeyCompleta && (!file || imagemAntigaKeyCompleta !== file.key)) {
            try {
                await safeDeleteFromR2(imagemAntigaKeyCompleta);
            } catch (deleteError) {
                logger.error(`[PlacaService] Falha NÃO CRÍTICA ao excluir imagem antiga ${imagemAntigaKeyCompleta} do R2:`, deleteError);
            }
        }

        return placaAtualizadaDoc.toJSON();

    } catch (error) {
        const err = error as any;
        logger.error(`[PlacaService] Erro Mongoose/DB ao atualizar placa ID ${id}: ${err.message}`, { stack: err.stack, code: err.code, keyValue: err.keyValue });

        if (err.code === 11000) {
            const numPlaca = dadosParaAtualizar.numero_placa || placaAntiga.numero_placa; 
            throw new AppError(`Já existe uma placa com o número '${numPlaca}' nesta região.`, 409);
        }
        
        if (error instanceof AppError) throw error;
        throw new AppError(`Erro interno ao atualizar placa: ${err.message}`, 500);
    }
  }

  async getAllPlacas(empresaId: string, queryParams: any): Promise<any> {
    logger.info(`[PlacaService] Buscando placas para empresa ${empresaId}.`);
    // CORREÇÃO: Aumentar limite padrão de 10 para 1000 para suportar listagem completa
    const { page = 1, limit = 1000, sortBy = 'createdAt', order = 'desc', regiao_id, disponivel, search } = queryParams;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    if (isNaN(pageInt) || pageInt < 1 || isNaN(limitInt) || limitInt < 1) {
        throw new AppError('Parâmetros de paginação inválidos (page/limit).', 400);
    }
    
    logger.debug(`[PlacaService] Paginação: page=${pageInt}, limit=${limitInt}`);
    logger.debug(`[PlacaService] Filtros: regiao_id=${regiao_id}, disponivel=${disponivel}, search=${search}`);
    
    const skip = (pageInt - 1) * limitInt;
    const sortOrder = order === 'desc' ? -1 : 1;

    let query: any = { empresaId: empresaId };
    if (regiao_id && regiao_id !== 'todas') {
        if (mongoose.Types.ObjectId.isValid(regiao_id)) {
            query.regiaoId = regiao_id; // ✅ CORREÇÃO: Usar 'regiaoId' ao invés de 'regiao'
        } else {
             logger.warn(`[PlacaService] regiao_id inválido fornecido: ${regiao_id}. Ignorando filtro.`);
        }
    }
    if (disponivel === 'true' || disponivel === 'false') {
        query.disponivel = disponivel === 'true';
    }
    if (search) {
        const searchRegex = new RegExp(search.trim(), 'i'); 
        query.$or = [
            { numero_placa: searchRegex },
            { nomeDaRua: searchRegex }
        ];
    }

    try {
        const [placasDocs, totalDocs] = await Promise.all([
            Placa.find(query)
                .populate('regiaoId', 'nome') // ✅ Padronizado 
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(limitInt)
                .exec(), 
            Placa.countDocuments(query)
        ]);

        const placas = placasDocs.map(doc => doc.toJSON());
        logger.info(`[PlacaService] Encontradas ${placas.length} placas nesta página. Total de documentos: ${totalDocs}.`);

        const hoje = new Date();
        const placaIds = placas.map(p => p.id).filter(id => id); 

        if (placaIds.length > 0) {
            // Busca QUALQUER aluguel (presente ou futuro) para mostrar status correto
            // Ordena por startDate para pegar o mais próximo
            // Suporta ambos os formatos: novo (startDate/endDate) e antigo (data_inicio/data_fim)
            const alugueisAtivos = await Aluguel.find({
                $and: [
                    {
                        $or: [
                            { placaId: { $in: placaIds } },
                            { placa: { $in: placaIds } } // Suporte a campo legado
                        ]
                    },
                    {
                        $or: [
                            { empresaId: empresaId },
                            { empresa: empresaId } // Suporte a campo legado
                        ]
                    },
                    {
                        $or: [
                            { endDate: { $gte: hoje } }, // Novo formato
                            { data_fim: { $gte: hoje } } // Formato legado
                        ]
                    }
                ]
            }).sort({ startDate: 1, data_inicio: 1 })
              .populate('clienteId', 'nome')
              .lean(); 

            // Agrupa alugueis por placa (pega o primeiro = mais próximo)
            const aluguelMap: Record<string, any> = alugueisAtivos.reduce((map: Record<string, any>, aluguel: any) => {
                const placaId = (aluguel.placaId || aluguel.placa)?.toString();
                if (placaId && !map[placaId]) {
                    // Normaliza os campos para o formato novo
                    const normalizado = {
                        ...aluguel,
                        startDate: aluguel.startDate || aluguel.data_inicio,
                        endDate: aluguel.endDate || aluguel.data_fim,
                        cliente: aluguel.clienteId || aluguel.cliente
                    };
                    map[placaId] = normalizado;
                }
                return map;
            }, {});

            placas.forEach((placa: any) => {
                const aluguel = aluguelMap[placa.id]; 
                if (aluguel && aluguel.cliente) {
                    placa.cliente_nome = aluguel.cliente.nome;
                    placa.aluguel_data_inicio = aluguel.startDate;
                    placa.aluguel_data_fim = aluguel.endDate;
                    placa.aluguel_ativo = true;
                    // Indica se o aluguel é futuro (ainda não começou)
                    placa.aluguel_futuro = new Date(aluguel.startDate) > hoje;
                    
                    // NOVO: Status dinâmico baseado nas datas
                    const dataInicio = new Date(aluguel.startDate);
                    const dataFim = new Date(aluguel.endDate);
                    
                    if (dataInicio > hoje) {
                        placa.statusAluguel = 'reservada'; // Data futura
                    } else if (dataFim >= hoje) {
                        placa.statusAluguel = 'alugada'; // Em andamento
                    } else {
                        placa.statusAluguel = 'disponivel'; // Aluguel expirado
                    }
                } else {
                    placa.aluguel_ativo = false;
                    placa.aluguel_futuro = false;
                    placa.statusAluguel = 'disponivel'; // Sem aluguel ativo
                }
            });
        }

        const totalPages = Math.ceil(totalDocs / limitInt);
        const pagination = { totalDocs, totalPages, currentPage: pageInt, limit: limitInt };

        return { data: placas, pagination };

    } catch (error) {
        const err = error as any;
        logger.error(`[PlacaService] Erro Mongoose/DB ao buscar placas: ${err.message}`, { stack: err.stack });
        if (error instanceof AppError) throw error;
        throw new AppError(`Erro interno ao buscar placas: ${err.message}`, 500);
    }
  }

  async getPlacaById(id: string, empresaId: string): Promise<any> {
    const cacheKey = `placa:${id}:empresa:${empresaId}`;

    logger.info(`[PlacaService] Buscando placa ID ${id} para empresa ${empresaId}`);

    try {
      // Cache-Aside: Try to get from cache first
      const cachedPlaca = await cacheService.get(cacheKey);
      if (cachedPlaca) {
        logger.debug(`[PlacaService] Cache HIT for placa ${id}`);
        return cachedPlaca;
      }

      logger.debug(`[PlacaService] Cache MISS for placa ${id}, fetching from DB`);

      const placaDoc = await Placa.findOne({ _id: id, empresaId: empresaId })
                                  .populate('regiaoId', 'nome')
                                  .exec();

      if (!placaDoc) {
        throw new AppError('Placa não encontrada.', 404);
      }

      const placa = placaDoc.toJSON();

      logger.info(`[PlacaService] Placa ${placa.numero_placa} (ID: ${id}) encontrada.`);

      // Busca qualquer aluguel válido (presente ou futuro)
      const hoje = new Date();
      const aluguelAtivo = await Aluguel.findOne({
          $or: [
              { placaId: placa.id, empresaId: empresaId, endDate: { $gte: hoje } },
              { placa: placa.id, empresa: empresaId, data_fim: { $gte: hoje } }
          ]
      }).sort({ startDate: 1, data_inicio: 1 })
        .populate('clienteId', 'nome')
        .lean();

      if (aluguelAtivo && (aluguelAtivo as any).cliente) {
          (placa as any).cliente_nome = (aluguelAtivo as any).cliente.nome;
          (placa as any).aluguel_data_inicio = (aluguelAtivo as any).data_inicio;
          (placa as any).aluguel_data_fim = (aluguelAtivo as any).data_fim;
          (placa as any).aluguel_ativo = true;
          (placa as any).aluguel_futuro = (aluguelAtivo as any).data_inicio > hoje;
      }

      // Cache-Aside: Store in cache for future requests (TTL: 10 minutes)
      await cacheService.set(cacheKey, placa, 600);

      return placa;

    } catch (error) {
        const err = error as any;
        logger.error(`[PlacaService] Erro Mongoose/DB ao buscar placa por ID ${id}: ${err.message}`, { stack: err.stack });
        if (error instanceof AppError) throw error;
        throw new AppError(`Erro interno ao buscar detalhes da placa: ${err.message}`, 500);
    }
  }

  async deletePlaca(id: string, empresaId: string): Promise<void> {
    logger.info(`[PlacaService] Tentando apagar placa ID ${id} para empresa ${empresaId}.`);

    try {
        const hoje = new Date();
        const aluguelAtivo = await Aluguel.findOne({
            placa: id,
            empresa: empresaId,
            data_inicio: { $lte: hoje },
            data_fim: { $gte: hoje }
        }).lean(); 

        if (aluguelAtivo) {
            throw new AppError('Não é possível apagar uma placa que está atualmente alugada.', 409);
        }

        const placaApagada = await Placa.findOneAndDelete({ _id: id, empresaId: empresaId });

        if (!placaApagada) {
            throw new AppError('Placa não encontrada.', 404);
        }
        logger.info(`[PlacaService] Placa ${placaApagada.numero_placa} (ID: ${id}) apagada com sucesso do DB.`);

        if (placaApagada.imagem) {
            const imagemKeyCompleta = `${process.env.R2_FOLDER_NAME || 'inmidia-uploads-sistema'}/${placaApagada.imagem}`;
            try {
                await safeDeleteFromR2(imagemKeyCompleta);
            } catch (deleteError) {
                logger.error(`[PlacaService] Falha NÃO CRÍTICA ao excluir imagem ${imagemKeyCompleta} do R2 para placa apagada ID ${id}:`, deleteError);
            }
        }

    } catch (error) {
        const err = error as any;
        logger.error(`[PlacaService] Erro Mongoose/DB ao apagar placa ID ${id}: ${err.message}`, { stack: err.stack, code: err.code });
        if (error instanceof AppError) throw error;
        throw new AppError(`Erro interno ao apagar placa: ${err.message}`, 500);
    }
  }

  async toggleDisponibilidade(id: string, empresaId: string): Promise<any> {
    logger.info(`[PlacaService] Tentando alternar disponibilidade da placa ID ${id} para empresa ${empresaId}`);

    let placa;
    try {
        placa = await Placa.findOne({ _id: id, empresaId: empresaId });
        if (!placa) {
            throw new AppError('Placa não encontrada.', 404);
        }

        if (placa.disponivel) { 
             const hoje = new Date();
             const aluguelAtivo = await Aluguel.findOne({
                placa: id,
                empresa: empresaId,
                data_inicio: { $lte: hoje },
                data_fim: { $gte: hoje }
             }).lean(); 

             if (aluguelAtivo) {
                throw new AppError('Não é possível colocar uma placa alugada em manutenção.', 409);
             }
        }

        placa.disponivel = !placa.disponivel;
        await placa.save();

        await placa.populate('regiaoId', 'nome'); // ✅ Padronizado
        return placa.toJSON();

    } catch (error) {
        const err = error as any;
        logger.error(`[PlacaService] Erro Mongoose/DB ao alternar disponibilidade da placa ID ${id}: ${err.message}`, { stack: err.stack, code: err.code });
        if (error instanceof AppError) throw error;
        throw new AppError(`Erro interno ao alternar disponibilidade: ${err.message}`, 500);
    }
  }

  async getAllPlacaLocations(empresaId: string): Promise<any[]> {
    logger.info(`[PlacaService] Buscando localizações de placas para empresa ${empresaId}.`);
    try {
        const locations = await Placa.find(
            { empresaId: empresaId, coordenadas: { $exists: true, $nin: [null, ""] } }, 
            '_id numero_placa nomeDaRua coordenadas'
        ).lean(); 
        
        const locationsFormatted = locations.map(location => ({
            id: location._id ? location._id.toString() : undefined,
            numero_placa: location.numero_placa,
            nomeDaRua: location.nomeDaRua,
            coordenadas: location.coordenadas
        }));

        logger.info(`[PlacaService] Encontradas ${locationsFormatted.length} localizações de placas para empresa ${empresaId}.`);
        return locationsFormatted;
        
    } catch (error) {
        const err = error as any;
        logger.error(`[PlacaService] Erro Mongoose/DB ao buscar localizações de placas: ${err.message}`, { stack: err.stack });
        throw new AppError(`Erro interno ao buscar localizações: ${err.message}`, 500);
    }
  }

  async getPlacasDisponiveis(empresaId: string, dataInicio: string, dataFim: string, queryParams: any = {}): Promise<any[]> {
    logger.info(`[PlacaService] Buscando placas disponíveis de ${dataInicio} a ${dataFim} para empresa ${empresaId}.`);

    if (!empresaId) {
      logger.error(`[PlacaService] empresaId não fornecido!`);
      throw new AppError('Empresa ID é obrigatório', 400);
    }

    // *** INÍCIO DA CORREÇÃO ***
    // 1. Extrai os filtros (regiao, search, excludePiId) dos queryParams
    const { regiao, search, excludePiId } = queryParams;
    // *** FIM DA CORREÇÃO ***

    const startDate = new Date(dataInicio);
    const endDate = new Date(dataFim);

    // Validação de datas
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new AppError('Datas de início ou fim inválidas.', 400);
    }
    if (endDate <= startDate) {
        throw new AppError('A data de fim deve ser posterior à data de início.', 400);
    }

    try {
        // 1. Encontrar IDs de placas em Alugueis que conflitam
        const alugueisOcupados = await Aluguel.find({
            empresa: empresaId,
            data_inicio: { $lte: endDate }, 
            data_fim: { $gte: startDate } 
        }).select('placa placaId').lean();
        
        const idsAlugadas = alugueisOcupados.map(a => ((a as any).placaId || (a as any).placa)?.toString()).filter(Boolean);
        logger.info(`[PlacaService] ${idsAlugadas.length} placas em aluguéis no período ${dataInicio} a ${dataFim}.`);
        if (idsAlugadas.length > 0) {
            logger.debug(`[PlacaService] IDs de placas alugadas: ${idsAlugadas.slice(0, 5).join(', ')}${idsAlugadas.length > 5 ? '...' : ''}`);
        }

        // 2. Encontrar IDs de placas em PIs que conflitam
        const piQuery = {
            empresa: empresaId,
            status: { $in: ['em_andamento', 'concluida'] }, 
            dataInicio: { $lte: endDate }, 
            dataFim: { $gte: startDate }
        };
        
        // Exclui a PI atual se estiver editando (para permitir manter as placas já selecionadas)
        if (excludePiId) {
            (piQuery as any)._id = { $ne: excludePiId };
            logger.debug(`[PlacaService] Excluindo PI ${excludePiId} da verificação de disponibilidade.`);
        }
        
        const pisOcupadas = await PropostaInterna.find(piQuery).select('placas').lean();
        logger.debug(`[PlacaService] ${pisOcupadas.length} PIs encontradas no período.`);

        const idsEmPI = pisOcupadas.flatMap(pi => (pi.placas || []).map(p => p.toString()));
        logger.debug(`[PlacaService] ${idsEmPI.length} placas em PIs no período.`);


        // 3. Juntar todos os IDs ocupados (Set remove duplicatas)
        const placasOcupadasIds = [...new Set([...idsAlugadas, ...idsEmPI])];
        
        logger.info(`[PlacaService] Total: ${placasOcupadasIds.length} placas ocupadas no período.`);

        // 4. Buscar todas as placas da empresa que:
        
        // *** INÍCIO DA CORREÇÃO ***
        // 4.1. Define a query base
        // IMPORTANTE: Filtra por 'disponivel: true' E também verifica conflitos de datas
        // Isso garante que placas manualmente indisponibilizadas não apareçam
        const finalQuery: any = {
            empresa: empresaId,
            disponivel: true, // Apenas placas disponíveis
            _id: { $nin: placasOcupadasIds } // E sem conflitos de data
        };

        // 4.2. Adiciona filtro de REGIÃO (se fornecido)
        if (regiao) {
            finalQuery.regiao = regiao;
            logger.debug(`[PlacaService] Adicionando filtro de regiao: ${regiao}`);
        }

        // 4.3. Adiciona filtro de SEARCH (se fornecido)
        if (search) {
            const searchRegex = new RegExp(search.trim(), 'i'); 
            finalQuery.$or = [
                { numero_placa: searchRegex },
                { nomeDaRua: searchRegex }
            ];
            logger.debug(`[PlacaService] Adicionando filtro de search: ${search}`);
        }
        // *** FIM DA CORREÇÃO ***

        logger.debug(`[PlacaService] Query final para buscar placas: ${JSON.stringify(finalQuery)}`);

        const placasDisponiveisDocs = await Placa.find(finalQuery) // <-- USA A QUERY FINAL
            .populate('regiaoId', 'nome') // ✅ Padronizado
            .sort({ 'regiao.nome': 1, 'numero_placa': 1 }) 
            .exec(); 

        // 5. Mapeia para JSON
        const placasDisponiveis = placasDisponiveisDocs.map(doc => doc.toJSON());
        
        logger.info(`[PlacaService] ✅ Retornando ${placasDisponiveis.length} placas disponíveis (${idsAlugadas.length} em aluguéis, ${idsEmPI.length} em PIs, ${placasOcupadasIds.length} total ocupadas).`);
        
        if (placasDisponiveis.length > 0) {
            logger.debug(`[PlacaService] Primeiras placas disponíveis: ${placasDisponiveis.slice(0, 3).map(p => p.numero_placa).join(', ')}`);
        }
        
        return placasDisponiveis;

    } catch (error) {
        const err = error as any;
        logger.error(`[PlacaService] Erro Mongoose/DB ao buscar placas disponíveis: ${err.message}`, { stack: err.stack });
        if (error instanceof AppError) throw error;
        throw new AppError(`Erro interno ao buscar placas disponíveis: ${err.message}`, 500);
    }
  }
}
