// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
/**
 * Regiao Controller (OLD)
 * DEPRECADO: Use controllers/regiao.controller.ts
 */
// src/modules/regioes/regiao.controller.ts
import { Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import RegiaoService from './regiao.service';
import logger from '@shared/container/logger';
import cacheService from '@shared/container/cache.service';

// Instancia o serviço fora das funções do controller
const regiaoService = new RegiaoService();

/**
 * Controller para obter todas as regiões da empresa.
 * GET /api/v1/regioes
 */
export async function getAllRegioes(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = (req.user as any).empresaId;
    const userId = (req.user as any).id;

    logger.info(`[RegiaoController] Utilizador ${userId} requisitou getAllRegioes para empresa ${empresa_id}.`);

    try {
        const cacheKey = `regioes:empresa:${empresa_id}`;
        const cachedRegioes = await cacheService.get(cacheKey);
        
        if (cachedRegioes) {
            logger.info(`[RegiaoController] Cache HIT para getAllRegioes empresa ${empresa_id}.`);
            res.status(200).json(cachedRegioes);
            return;
        }

        logger.info(`[RegiaoController] Cache MISS para getAllRegioes empresa ${empresa_id}. Consultando banco...`);
        const regioes = await regiaoService.getAll(empresa_id);
        
        await cacheService.set(cacheKey, regioes, 300);
        
        logger.info(`[RegiaoController] getAllRegioes retornou ${regioes.length} regiões para empresa ${empresa_id}.`);
        res.status(200).json(regioes);
    } catch (err: any) {
        logger.error(`[RegiaoController] Erro ao chamar regiaoService.getAll: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * Controller para criar uma nova região.
 * POST /api/v1/regioes
 */
export async function createRegiao(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = (req.user as any).empresaId;
    const userId = (req.user as any).id;
    const { nome } = req.body;

    logger.info(`[RegiaoController] Utilizador ${userId} requisitou createRegiao ('${nome}') para empresa ${empresa_id}.`);

    try {
        const novaRegiao = await regiaoService.create(nome, empresa_id);
        
        await cacheService.del(`regioes:empresa:${empresa_id}`);
        
        logger.info(`[RegiaoController] createRegiao bem-sucedida. Nova região ID: ${novaRegiao.id} ('${novaRegiao.nome}').`);
        res.status(201).json(novaRegiao);
    } catch (err: any) {
        logger.error(`[RegiaoController] Erro ao chamar regiaoService.create: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * Controller para atualizar o nome de uma região existente.
 * PUT /api/v1/regioes/:id
 */
export async function updateRegiao(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = (req.user as any).empresaId;
    const userId = (req.user as any).id;
    const { id: regiaoIdToUpdate } = req.params;
    const { nome: novoNome } = req.body;

    logger.info(`[RegiaoController] Utilizador ${userId} requisitou updateRegiao para ID: ${regiaoIdToUpdate} na empresa ${empresa_id}. Novo nome: '${novoNome}'`);

    try {
        const regiaoAtualizada = await regiaoService.update(regiaoIdToUpdate, novoNome, empresa_id);
        
        await cacheService.del(`regioes:empresa:${empresa_id}`);
        
        logger.info(`[RegiaoController] updateRegiao para ID ${regiaoIdToUpdate} concluído com sucesso.`);
        res.status(200).json(regiaoAtualizada);
    } catch (err: any) {
        logger.error(`[RegiaoController] Erro ao chamar regiaoService.update (ID: ${regiaoIdToUpdate}): ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * Controller para apagar uma região.
 * DELETE /api/v1/regioes/:id
 */
export async function deleteRegiao(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = (req.user as any).empresaId;
    const userId = (req.user as any).id;
    const { id: regiaoIdToDelete } = req.params;

    logger.info(`[RegiaoController] Utilizador ${userId} requisitou deleteRegiao para ID: ${regiaoIdToDelete} na empresa ${empresa_id}.`);

    try {
        await regiaoService.delete(regiaoIdToDelete, empresa_id);
        
        await cacheService.del(`regioes:empresa:${empresa_id}`);
        
        logger.info(`[RegiaoController] deleteRegiao para ID ${regiaoIdToDelete} concluído com sucesso.`);
        res.status(204).send();
    } catch (err: any) {
        logger.error(`[RegiaoController] Erro ao chamar regiaoService.delete (ID: ${regiaoIdToDelete}): ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

export default {
    getAllRegioes,
    createRegiao,
    updateRegiao,
    deleteRegiao
};

