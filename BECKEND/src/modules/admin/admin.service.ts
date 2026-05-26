/**
 * Admin Service
 * Gestão de usuários (admin functions)
 */

import bcrypt from 'bcrypt';
import User from '../users/User';
import logger from '../../shared/container/logger';
import AppError from '../../shared/container/AppError';

const saltRounds = 10;
const ALLOWED_RBAC_ROLES = [
    'superadmin',
    'admin_empresa',
    'gestor',
    'vendedor',
    'financeiro',
    'visualizador',
    'admin',
    'user'
];

class AdminService {
    constructor() {}

    async createUser(userData: any, empresa_id: string): Promise<any> {
        logger.info(`[AdminService] Tentando criar utilizador para empresa ${empresa_id}.`);
        logger.debug(`[AdminService] Dados recebidos: ${JSON.stringify(userData)}`);

        const { username, email, password, nome, sobrenome, role = 'vendedor' } = userData;

        if (!username || !email || !password || !nome || !sobrenome) {
            throw new AppError('Campos obrigatórios (username, email, password, nome, sobrenome) em falta.', 400);
        }

        try {
            logger.debug(`[AdminService] Verificando existência prévia de username: ${username} ou email: ${email} na empresa ${empresa_id}`);
            const userExists = await User.findOne({
                empresa: empresa_id,
                $or: [{ username }, { email }]
            }).lean().exec();

            if (userExists) {
                let field = userExists.username === username ? 'nome de utilizador' : 'email';
                throw new AppError(`Já existe um utilizador com este ${field} na sua empresa.`, 409);
            }

            logger.debug(`[AdminService] Hasheando senha para utilizador ${username}`);
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = new User({
                username, email, password: hashedPassword,
                nome, sobrenome, role,
                empresa: empresa_id
            });

            logger.debug(`[AdminService] Tentando salvar novo utilizador ${username} no DB.`);
            const createdUser = await newUser.save();
            logger.info(`[AdminService] Utilizador ${username} (ID: ${createdUser._id}) criado com sucesso para empresa ${empresa_id}.`);

            return createdUser.toJSON();

        } catch (error: any) {
            logger.error(`[AdminService] Erro Mongoose/DB ao criar utilizador: ${error.message}`, { stack: error.stack, code: error.code, keyValue: error.keyValue });

            if (error.code === 11000) {
                let field = Object.keys(error.keyValue)[0];
                field = field === 'email' ? 'e-mail' : (field === 'username' ? 'nome de utilizador' : field);
                throw new AppError(`Já existe um utilizador com este ${field}.`, 409);
            }
            if (error instanceof AppError) throw error;

            throw new AppError(`Erro interno ao criar utilizador: ${error.message}`, 500);
        }
    }

    async getAllUsers(empresa_id: string): Promise<any[]> {
        logger.info(`[AdminService] Buscando todos os utilizadores para empresa ${empresa_id}.`);
        try {
            const users = await User.find({ empresa: empresa_id })
                                    .select('username email nome sobrenome role createdAt')
                                    .lean()
                                    .exec();
            logger.info(`[AdminService] Encontrados ${users.length} utilizadores para empresa ${empresa_id}.`);
            return users;
        } catch (error: any) {
            logger.error(`[AdminService] Erro Mongoose/DB ao buscar todos os utilizadores: ${error.message}`, { stack: error.stack });
            throw new AppError(`Erro interno ao buscar utilizadores: ${error.message}`, 500);
        }
    }

    async updateUserRole(userId: string, newRole: string, empresa_id: string): Promise<{ message: string }> {
        logger.info(`[AdminService] Tentando atualizar role do utilizador ${userId} para ${newRole} na empresa ${empresa_id}.`);

        if (!newRole || !ALLOWED_RBAC_ROLES.includes(newRole)) {
            throw new AppError("A 'role' fornecida é inválida para RBAC.", 400);
        }

        try {
            const updateResult = await User.updateOne(
                { _id: userId, empresa: empresa_id },
                { $set: { role: newRole } }
            );

            if (updateResult.matchedCount === 0) {
                throw new AppError('Utilizador não encontrado na sua empresa.', 404);
            }

            if (updateResult.modifiedCount === 0) {
                logger.info(`[AdminService] Role do utilizador ${userId} já era '${newRole}'. Nenhuma alteração feita.`);
            } else {
                logger.info(`[AdminService] Role do utilizador ${userId} atualizada com sucesso para ${newRole}.`);
            }

            return { message: 'Nível de acesso do utilizador atualizado com sucesso!' };

        } catch (error: any) {
            logger.error(`[AdminService] Erro Mongoose/DB ao atualizar role: ${error.message}`, { stack: error.stack });
            if (error instanceof AppError) throw error;

            throw new AppError(`Erro interno ao atualizar role do utilizador: ${error.message}`, 500);
        }
    }

    async deleteUser(userId: string, adminUserId: string, empresa_id: string): Promise<{ success: boolean }> {
        logger.info(`[AdminService] Admin ${adminUserId} tentando apagar utilizador ${userId} na empresa ${empresa_id}.`);

        if (String(userId) === String(adminUserId)) {
            throw new AppError('Não é possível apagar a sua própria conta de administrador.', 400);
        }

        try {
            const result = await User.deleteOne({ _id: userId, empresa: empresa_id });

            if (result.deletedCount === 0) {
                throw new AppError('Utilizador não encontrado na sua empresa.', 404);
            }

            logger.info(`[AdminService] Utilizador ${userId} apagado com sucesso pelo admin ${adminUserId}.`);
            return { success: true };
        } catch (error: any) {
            logger.error(`[AdminService] Erro Mongoose/DB ao apagar utilizador: ${error.message}`, { stack: error.stack });
            if (error instanceof AppError) throw error;

            throw new AppError(`Erro interno ao apagar utilizador: ${error.message}`, 500);
        }
    }
}

export default AdminService;

