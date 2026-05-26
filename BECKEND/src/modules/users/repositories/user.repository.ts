/**
 * User Repository - Camada de acesso a dados com Result Pattern
 */

import { Model } from 'mongoose';
import { Result, DomainError, NotFoundError, DuplicateKeyError, ValidationError } from '@shared/core';
import type { IUser } from '../../../types/models';
import type { UpdateUserProfileInput } from '../dtos/user.dto';

export class UserNotFoundError extends NotFoundError {
  constructor(userId: string) {
    super(`Usuário com ID ${userId} não encontrado`, 'USER_NOT_FOUND');
  }
}

export interface IUserRepository {
  /**
   * Busca usuário por ID
   */
  findById(id: string, selectPassword?: boolean): Promise<Result<IUser | null, DomainError>>;

  /**
   * Busca usuário por username
   */
  findByUsername(username: string): Promise<Result<IUser | null, DomainError>>;

  /**
   * Busca usuário por email
   */
  findByEmail(email: string): Promise<Result<IUser | null, DomainError>>;

  /**
   * Atualiza perfil do usuário
   */
  updateProfile(
    id: string,
    updateData: UpdateUserProfileInput
  ): Promise<Result<IUser, DomainError>>;

  /**
   * Verifica se usuário existe
   */
  exists(id: string): Promise<Result<boolean, DomainError>>;
}

export class UserRepository implements IUserRepository {
  constructor(private readonly model: Model<IUser>) {}

  async findById(id: string, selectPassword = false): Promise<Result<IUser | null, DomainError>> {
    try {
      // select() retorna um Query com tipo ligeiramente diferente — cast necessário
      let query: any = this.model.findById(id);

      if (selectPassword) {
        query = query.select('+senha +password');
      } else {
        query = query.select('-senha -password');
      }

      const user = await query.lean().exec() as IUser | null;
      return Result.ok(user);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar usuário' }])
      );
    }
  }

  async findByUsername(username: string): Promise<Result<IUser | null, DomainError>> {
    try {
      const user = await this.model
        .findOne({ username })
        .select('-senha -password')
        .lean<IUser | null>()
        .exec();
      
      return Result.ok(user);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar usuário por username' }])
      );
    }
  }

  async findByEmail(email: string): Promise<Result<IUser | null, DomainError>> {
    try {
      const user = await this.model
        .findOne({ email: email.toLowerCase() })
        .select('-senha -password')
        .lean<IUser | null>()
        .exec();
      
      return Result.ok(user);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar usuário por email' }])
      );
    }
  }

  async updateProfile(
    id: string,
    updateData: UpdateUserProfileInput
  ): Promise<Result<IUser, DomainError>> {
    try {
      const updateFields: any = {};

      if (updateData.username !== undefined) {
        updateFields.username = updateData.username.trim();
      }
      if (updateData.email !== undefined) {
        updateFields.email = updateData.email.trim().toLowerCase();
      }
      if (updateData.nome !== undefined) {
        updateFields.nome = updateData.nome.trim();
      }
      if (updateData.telefone !== undefined) {
        updateFields.telefone = updateData.telefone.trim();
      }
      if (updateData.password !== undefined) {
        // Password será hasheado pelo pre-save hook
        updateFields.senha = updateData.password;
      }

      const user = await this.model
        .findByIdAndUpdate(
          id,
          { $set: updateFields },
          { new: true, runValidators: true }
        )
        .select('-senha -password')
        .lean<IUser | null>()
        .exec();

      if (!user) {
        return Result.fail(new UserNotFoundError(id));
      }

      return Result.ok(user);
    } catch (error: any) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        const fieldName = field === 'email' ? 'e-mail' : field === 'username' ? 'username' : field;
        return Result.fail(
          new DuplicateKeyError(
            `Este ${fieldName} já está em uso`
          )
        );
      }

      if (error.name === 'ValidationError') {
        const firstError = Object.values(error.errors)[0] as any;
        return Result.fail(
          new ValidationError([{
            field: 'geral',
            message: `Erro de validação: ${firstError.message}`
          }])
        );
      }

      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao atualizar perfil' }])
      );
    }
  }

  async exists(id: string): Promise<Result<boolean, DomainError>> {
    try {
      const count = await this.model.countDocuments({ _id: id }).exec();
      return Result.ok(count > 0);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao verificar existência do usuário' }])
      );
    }
  }
}
