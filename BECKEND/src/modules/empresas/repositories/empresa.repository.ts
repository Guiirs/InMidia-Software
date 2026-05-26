/**
 * Empresa Repository
 * Camada de acesso a dados com Result Pattern
 */

import { Model } from 'mongoose';
import { Result, DomainError, NotFoundError, DuplicateKeyError, ValidationError } from '@shared/core';
import type { IEmpresa } from '../../../types/models';
import type { UpdateEmpresaInput } from '../dtos/empresa.dto';

export class EmpresaNotFoundError extends NotFoundError {
  constructor(empresaId: string) {
    super(`Empresa com ID ${empresaId} não encontrada`, 'EMPRESA_NOT_FOUND');
  }
}

export interface IEmpresaRepository {
  /**
   * Cria uma nova empresa
   */
  create(empresaData: Partial<IEmpresa>): Promise<Result<IEmpresa, DomainError>>;

  /**
   * Busca empresa por ID
   */
  findById(id: string): Promise<Result<IEmpresa | null, DomainError>>;

  /**
   * Busca empresa por CNPJ
   */
  findByCnpj(cnpj: string): Promise<Result<IEmpresa | null, DomainError>>;

  /**
   * Atualiza empresa
   */
  update(
    id: string,
    updateData: UpdateEmpresaInput
  ): Promise<Result<IEmpresa, DomainError>>;

  /**
   * Busca API Key da empresa
   */
  getApiKey(id: string): Promise<Result<string, DomainError>>;

  /**
   * Regenera API Key da empresa
   */
  regenerateApiKey(id: string): Promise<Result<string, DomainError>>;

  /**
   * Verifica se empresa existe
   */
  exists(id: string): Promise<Result<boolean, DomainError>>;

  /**
   * Registra uma nova empresa com usuário admin
   */
  registerEmpresa?(
    empresaData: any,
    userData: any
  ): Promise<Result<{ empresaId: string; userId: string }, DomainError>>;
}

export class EmpresaRepository implements IEmpresaRepository {
  constructor(private readonly model: Model<IEmpresa>) {}

  async create(empresaData: Partial<IEmpresa>): Promise<Result<IEmpresa, DomainError>> {
    try {
      const empresa = new this.model(empresaData);
      await empresa.save();
      return Result.ok(empresa);
    } catch (error: any) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue || {})[0] || 'campo';
        const value = error.keyValue ? error.keyValue[field] : 'valor';
        return Result.fail(
          new DuplicateKeyError(
            `Empresa com ${field} '${value}' já existe`
          )
        );
      }
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao criar empresa' }])
      );
    }
  }

  async findById(id: string): Promise<Result<IEmpresa | null, DomainError>> {
    try {
      const empresa = await this.model
        .findById(id)
        .select('-apiKey -api_key_hash -api_key_prefix -api_key_history')
        .lean<IEmpresa | null>()
        .exec();
      
      return Result.ok(empresa);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar empresa' }])
      );
    }
  }

  async findByCnpj(cnpj: string): Promise<Result<IEmpresa | null, DomainError>> {
    try {
      const empresa = await this.model
        .findOne({ cnpj })
        .lean<IEmpresa | null>()
        .exec();
      
      return Result.ok(empresa);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar empresa por CNPJ' }])
      );
    }
  }

  async update(
    id: string,
    updateData: UpdateEmpresaInput
  ): Promise<Result<IEmpresa, DomainError>> {
    try {
      // Remove campos sensíveis que não devem ser atualizados
      const { apiKey, api_key_hash, api_key_prefix, ...allowedUpdates } = updateData as any;

      const empresa = await this.model
        .findByIdAndUpdate(
          id,
          allowedUpdates,
          { new: true, runValidators: true }
        )
        .select('-apiKey -api_key_hash -api_key_prefix -api_key_history')
        .lean<IEmpresa | null>()
        .exec();

      if (!empresa) {
        return Result.fail(new EmpresaNotFoundError(id));
      }

      return Result.ok(empresa);
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        return Result.fail(
          new ValidationError([{
            field: 'geral',
            message: `Dados de atualização inválidos: ${error.message}`
          }])
        );
      }
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao atualizar empresa' }])
      );
    }
  }

  async getApiKey(id: string): Promise<Result<string, DomainError>> {
    try {
      const empresa = await this.model
        .findById(id)
        .select('apiKey api_key_prefix')
        .lean()
        .exec();

      if (!empresa) {
        return Result.fail(new EmpresaNotFoundError(id));
      }

      const apiKeyPrefix = (empresa as any).api_key_prefix || (empresa as any).apiKey;

      if (!apiKeyPrefix) {
        return Result.fail(
          new NotFoundError('API Key não encontrada', 'API_KEY_NOT_FOUND')
        );
      }

      return Result.ok(apiKeyPrefix);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar API Key' }])
      );
    }
  }

  async regenerateApiKey(id: string): Promise<Result<string, DomainError>> {
    try {
      const empresa = await this.model.findById(id).exec();

      if (!empresa) {
        return Result.fail(new EmpresaNotFoundError(id));
      }

      // Usa o método do schema para gerar novo API Key
      if (typeof empresa.generateApiKey === 'function') {
        const newApiKey = empresa.generateApiKey();
        await empresa.save();
        return Result.ok(newApiKey);
      }

      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Método generateApiKey não disponível' }])
      );
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao regenerar API Key' }])
      );
    }
  }

  async exists(id: string): Promise<Result<boolean, DomainError>> {
    try {
      const count = await this.model.countDocuments({ _id: id }).exec();
      return Result.ok(count > 0);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao verificar existência da empresa' }])
      );
    }
  }

  async registerEmpresa(
    empresaData: any,
    userData: any
  ): Promise<Result<{ empresaId: string; userId: string }, DomainError>> {
    const session = await this.model.startSession();
    session.startTransaction();
    
    try {
      // Valida dados da empresa
      if (!empresaData.nome || !empresaData.cnpj) {
        await session.abortTransaction();
        return Result.fail(
          new ValidationError([
            { field: 'empresa', message: 'Nome e CNPJ são obrigatórios' }
          ])
        );
      }

      // Verifica se CNPJ já existe
      const existingEmpresa = await this.model.findOne({ cnpj: empresaData.cnpj });
      if (existingEmpresa) {
        await session.abortTransaction();
        return Result.fail(
          new DuplicateKeyError(`Empresa com CNPJ '${empresaData.cnpj}' já existe`)
        );
      }

      // Cria nova empresa
      const empresa = new this.model({
        nome: empresaData.nome_empresa || empresaData.nome,
        cnpj: empresaData.cnpj,
        telefone: empresaData.telefone,
        email: empresaData.email,
        endereco: empresaData.endereco,
        ativo: true,
      });
      await empresa.save({ session });

      // Valida dados do usuário
      if (!userData.email || !userData.password) {
        await session.abortTransaction();
        return Result.fail(
          new ValidationError([
            { field: 'usuario', message: 'Email e senha são obrigatórios' }
          ])
        );
      }

      // Importa o modelo de User dinamicamente para evitar circular dependency
      try {
        const User = (await import('@modules/users/User')).default;
        
        // Cria usuário admin (NÃO fazer hash aqui - deixar pre-save hook fazer)
        const newUser = new User({
          username: userData.username,
          email: userData.email,
          password: userData.password,  // IMPORTANTE: Deixar sem hash - pre-save hook fará isso
          nome: userData.nome,
          sobrenome: userData.sobrenome,
          role: 'admin',
          empresa: empresa._id,
          ativo: true,
        });
        await newUser.save({ session });

        await session.commitTransaction();

        return Result.ok({
          empresaId: empresa._id.toString(),
          userId: newUser._id.toString(),
        });
      } catch (userError: any) {
        await session.abortTransaction();
        
        if (userError.code === 11000) {
          const field = Object.keys(userError.keyValue || {})[0] || 'campo';
          return Result.fail(
            new DuplicateKeyError(`${field} já está em uso`)
          );
        }
        
        return Result.fail(
          new ValidationError([{ field: 'usuario', message: 'Erro ao criar usuário' }])
        );
      }
    } catch (error: any) {
      await session.abortTransaction();
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue || {})[0] || 'campo';
        const value = error.keyValue ? error.keyValue[field] : 'valor';
        return Result.fail(
          new DuplicateKeyError(`${field} '${value}' já existe`)
        );
      }

      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao registar empresa: ' + error.message }])
      );
    } finally {
      session.endSession();
    }
  }
}
