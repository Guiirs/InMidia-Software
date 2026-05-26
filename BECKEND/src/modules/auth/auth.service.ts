/**
 * Auth Service (OLD)
 * DEPRECADO: Use services/auth.service.ts
 */
// src/services/authService.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '@modules/users/User';
import config from '@config/config';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';

interface UserPayload {
    id: any;
    empresaId: any;
    role: string;
    username: string;
    email: string;
}

interface LoginResult {
    token: string;
    user: {
        id: any;
        username: string;
        email: string;
        nome?: string;
        sobrenome?: string;
        role: string;
        empresaId: any;
        createdAt?: Date;
    };
}

interface ChangePasswordResult {
    message: string;
}

class AuthService {
    constructor() {}

    /**
     * Gera um token JWT para um utilizador.
     */
    generateToken(user: UserPayload): string {
        const payload = {
            id: user.id,
            empresaId: user.empresaId,
            role: user.role,
            username: user.username,
            email: user.email
        };

        // SignOptions.expiresIn no @types/jsonwebtoken v9 espera `number | StringValue`.
        // Cast via unknown para evitar incompatibilidade sem perder a funcionalidade.
        const token = jwt.sign(
            payload,
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn } as any
        );

        logger.debug(`[AuthService] Token JWT gerado para o utilizador ${user.username} (ID: ${user.id}). Expira em ${config.jwtExpiresIn}.`);
        return token;
    }

    /**
     * Autentica um utilizador e retorna um token.
     */
    async login(usernameOrEmail: string, password: string): Promise<LoginResult> {
        logger.info(`[AuthService] Tentativa de login para: ${usernameOrEmail}`);
        
        try {
            const user = await User.findOne({ 
                $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
            }).select('+senha +password +empresa').lean();

            if (!user) {
                logger.warn(`[AuthService] Tentativa de login falhada: Utilizador não encontrado para ${usernameOrEmail}.`);
                throw new AppError('Credenciais inválidas.', 401);
            }

            // Usar senha ou password dependendo do que existe no banco
            const senhaHash = (user as any).senha || (user as any).password;
            const isMatch = await bcrypt.compare(password, senhaHash);

            if (!isMatch) {
                logger.warn(`[AuthService] Tentativa de login falhada: Senha incorreta para utilizador ${user.username}.`);
                throw new AppError('Credenciais inválidas.', 401);
            }

            logger.info(`[AuthService] Login bem-sucedido para utilizador ${user.username} (ID: ${user._id}).`);
            logger.debug(`[AuthService] Dados do user do banco: empresa=${user.empresa}`);

            const userForToken: UserPayload = {
                id: user._id,
                empresaId: user.empresa, // Usando campo real do banco
                role: user.role,
                username: user.username,
                email: user.email,
            };
            
            logger.debug(`[AuthService] userForToken criado: ${JSON.stringify(userForToken)}`);
            
            const token = this.generateToken(userForToken);

            const userData = {
                id: user._id,
                username: user.username,
                email: user.email,
                nome: user.nome,
                telefone: user.telefone,
                role: user.role,
                empresaId: user.empresa, // Usando campo real do banco
                createdAt: user.createdAt,
            };
            
            return { token, user: userData };

        } catch (error: any) {
            logger.error(`[AuthService] Erro no login: ${error.message}`, { stack: error.stack, status: error.status });
            
            if (error instanceof AppError) throw error; 
            throw new AppError(`Erro interno durante o login: ${error.message}`, 500);
        }
    }
    
    /**
     * Altera a senha do utilizador.
     */
    async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<ChangePasswordResult> {
        logger.info(`[AuthService] Tentativa de alteração de senha para ID: ${userId}`);

        if (oldPassword === newPassword) {
            throw new AppError('A nova senha não pode ser igual à senha atual.', 400);
        }

        try {
            const user = await User.findById(userId).select('+senha +password').exec();

            if (!user) {
                logger.warn(`[AuthService] Alteração de senha falhada: Utilizador ID ${userId} não encontrado.`);
                throw new AppError('Utilizador não encontrado.', 404);
            }

            const senhaHash = (user as any).senha || (user as any).password;
            const isMatch = await bcrypt.compare(oldPassword, senhaHash);

            if (!isMatch) {
                logger.warn(`[AuthService] Alteração de senha falhada: Senha antiga incorreta para ID ${userId}.`);
                throw new AppError('A senha antiga está incorreta.', 400);
            }

            const newHashedPassword = await bcrypt.hash(newPassword, 10);
            // Atualizar no campo correto (usar password se senha não existe)
            if ((user as any).senha !== undefined) {
                user.senha = newHashedPassword;
            } else {
                (user as any).password = newHashedPassword;
            }
            await user.save();

            logger.info(`[AuthService] Senha alterada com sucesso para ID: ${userId}`);
            return { message: 'Senha alterada com sucesso.' };

        } catch (error: any) {
            logger.error(`[AuthService] Erro ao alterar senha para ID ${userId}: ${error.message}`, { stack: error.stack, status: error.status });
            
            if (error instanceof AppError) throw error; 
            throw new AppError(`Erro interno ao alterar senha: ${error.message}`, 500);
        }
    }

    /**
     * Solicita redefinição de senha para um email.
     */
    async requestPasswordReset(email: string): Promise<void> {
        logger.info(`[AuthService] Solicitação de redefinição de senha para email: ${email}`);

        try {
            const user = await User.findOne({ email }).exec();
            if (!user) {
                // Não revelar se o email existe ou não por segurança
                logger.info(`[AuthService] Solicitação de redefinição para email não registado: ${email}`);
                return;
            }

            // Gerar token de redefinição (simplificado - em produção usar JWT ou similar)
            const resetToken = this.generateToken({
                id: user._id,
                empresaId: (user as any).empresaId,
                role: (user as any).role || 'user',
                username: (user as any).username || '',
                email: user.email
            });

            // Em produção, enviar email com o token
            logger.info(`[AuthService] Token de redefinição gerado para ${email}: ${resetToken.substring(0, 10)}...`);

            // TODO: Implementar envio de email
            // await emailService.sendPasswordResetEmail(email, resetToken);

        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[AuthService] Erro ao solicitar redefinição de senha para ${email}: ${err.message}`, { stack: (err as any).stack });
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao solicitar redefinição de senha: ${err.message}`, 500);
        }
    }

    /**
     * Redefine senha usando token.
     */
    async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
        logger.info(`[AuthService] Tentativa de redefinição de senha com token`);

        try {
            // Verificar token (simplificado)
            const decoded = jwt.verify(token, config.jwtSecret) as any;
            
            const user = await User.findById(decoded.id).exec();
            if (!user) {
                throw new AppError('Token inválido ou expirado.', 400);
            }

            // Hash da nova senha
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            if ((user as any).senha !== undefined) {
                (user as any).senha = hashedPassword;
            } else {
                (user as any).password = hashedPassword;
            }
            await user.save();

            logger.info(`[AuthService] Senha redefinida com sucesso para usuário ID: ${user._id}`);

        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[AuthService] Erro ao redefinir senha com token: ${err.message}`, { stack: (err as any).stack });
            if (error instanceof AppError) throw error;
            throw new AppError('Token inválido ou expirado.', 400);
        }
    }

    /**
     * Verifica se token de redefinição é válido.
     */
    async verifyPasswordResetToken(token: string): Promise<void> {
        logger.info(`[AuthService] Verificação de token de redefinição`);

        try {
            const decoded = jwt.verify(token, config.jwtSecret) as any;
            
            const user = await User.findById(decoded.id).exec();
            if (!user) {
                throw new AppError('Token inválido ou expirado.', 400);
            }

            logger.info(`[AuthService] Token verificado como válido para usuário ID: ${user._id}`);

        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[AuthService] Erro ao verificar token: ${err.message}`, { stack: (err as any).stack });
            throw new AppError('Token inválido ou expirado.', 400);
        }
    }
}

export default AuthService;

