/**
 * Regiao Service (OLD)
 * DEPRECADO: Use services/regiao.service.ts
 */
// src/modules/regioes/regiao.service.ts
import Regiao from './Regiao';
import Placa from '@modules/placas/Placa';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';

class RegiaoService {
    constructor() {}

    async getAll(empresa_id: string): Promise<any[]> {
        logger.info(`[RegiaoService] Buscando todas as regiões para empresa ${empresa_id}.`);
        try {
            const regioes = await Regiao.find({ empresaId: empresa_id })
                                        .sort({ nome: 1 })
                                        .lean()
                                        .exec();
            logger.info(`[RegiaoService] Encontradas ${regioes.length} regiões para empresa ${empresa_id}.`);
            return regioes;
        } catch (error: any) {
            logger.error(`[RegiaoService] Erro Mongoose/DB ao buscar todas as regiões: ${error.message}`, { stack: error.stack });
            throw new AppError(`Erro interno ao buscar regiões: ${error.message}`, 500);
        }
    }

    async create(nome: string, empresa_id: string): Promise<any> {
        logger.info(`[RegiaoService] Tentando criar região '${nome}' para empresa ${empresa_id}.`);

        if (!nome || typeof nome !== 'string' || nome.trim() === '') {
            throw new AppError('O nome da região é obrigatório e não pode ser vazio.', 400);
        }
        const nomeTrimmed = nome.trim();

        const novaRegiao = new Regiao({
            nome: nomeTrimmed,
            empresaId: empresa_id
        });

        try {
            logger.debug(`[RegiaoService] Tentando salvar nova região '${nomeTrimmed}' no DB.`);
            const regiaoSalva = await novaRegiao.save();
            logger.info(`[RegiaoService] Região '${regiaoSalva.nome}' (ID: ${regiaoSalva._id}) criada com sucesso para empresa ${empresa_id}.`);
            
            return regiaoSalva.toJSON();
            
        } catch (error: any) {
            logger.error(`[RegiaoService] Erro Mongoose/DB ao criar região: ${error.message}`, { stack: error.stack, code: error.code, keyValue: error.keyValue });

            if (error.code === 11000) {
                throw new AppError(`Já existe uma região com o nome '${nomeTrimmed}' na sua empresa.`, 409);
            }
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao criar região: ${error.message}`, 500);
        }
    }

    async update(id: string, nome: string, empresa_id: string): Promise<any> {
        logger.info(`[RegiaoService] Tentando atualizar região ID ${id} para nome '${nome}' na empresa ${empresa_id}.`);

        if (!nome || typeof nome !== 'string' || nome.trim() === '') {
            throw new AppError('O novo nome da região é obrigatório e não pode ser vazio.', 400);
        }
        const nomeTrimmed = nome.trim();

        try {
            logger.debug(`[RegiaoService] Tentando encontrar e atualizar região ID ${id} no DB.`);
            
            const regiaoAtualizada = await Regiao.findOneAndUpdate(
                { _id: id, empresaId: empresa_id },
                { $set: { nome: nomeTrimmed } },
                { new: true, runValidators: true }
            );

            if (!regiaoAtualizada) {
                throw new AppError('Região não encontrada.', 404);
            }
            logger.info(`[RegiaoService] Região ID ${id} atualizada com sucesso para nome '${regiaoAtualizada.nome}'.`);
            
            return regiaoAtualizada.toJSON();

        } catch (error: any) {
            logger.error(`[RegiaoService] Erro Mongoose/DB ao atualizar região ID ${id}: ${error.message}`, { stack: error.stack, code: error.code, keyValue: error.keyValue });

            if (error.code === 11000) {
                throw new AppError(`Já existe uma região com o nome '${nomeTrimmed}' na sua empresa.`, 409);
            }
            
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao atualizar região: ${error.message}`, 500);
        }
    }

    async delete(id: string, empresa_id: string): Promise<{ success: boolean }> {
        logger.info(`[RegiaoService] Tentando apagar região ID ${id} para empresa ${empresa_id}.`);

        try {
            logger.debug(`[RegiaoService] Verificando se alguma placa usa a região ID ${id}.`);
            const placaUsandoRegiao = await Placa.findOne({
                $or: [
                    { regiaoId: id },
                    { regiao: id } // Suporte legado
                ],
                empresaId: empresa_id
            }).lean().exec();

            if (placaUsandoRegiao) {
                throw new AppError('Não é possível apagar esta região, pois está a ser utilizada por uma ou mais placas.', 400);
            }
            logger.debug(`[RegiaoService] Nenhuma placa encontrada usando a região ID ${id}. Prosseguindo com a exclusão.`);

            logger.debug(`[RegiaoService] Tentando apagar região ID ${id} do DB.`);
            const result = await Regiao.deleteOne({ _id: id, empresaId: empresa_id });

            if (result.deletedCount === 0) {
                throw new AppError('Região não encontrada.', 404);
            }

            logger.info(`[RegiaoService] Região ID ${id} apagada com sucesso.`);
            return { success: true };

        } catch (error: any) {
            logger.error(`[RegiaoService] Erro Mongoose/DB ao apagar região ID ${id}: ${error.message}`, { stack: error.stack, code: error.code });
            
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao apagar região: ${error.message}`, 500);
        }
    }
}

export default RegiaoService;

