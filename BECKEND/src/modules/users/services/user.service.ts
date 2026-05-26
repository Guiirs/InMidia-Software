/**
 * User Service - Lógica de negócio
 */

import { Result, NotFoundError, ValidationError } from '@shared/core';
import { ZodError } from 'zod';
import type { IUserRepository } from '../repositories/user.repository';
import type {
  UpdateUserProfileInput,
  UserProfileResponse,
} from '../dtos/user.dto';

export class UserService {
  constructor(private readonly repository: IUserRepository) {}

  /**
   * Busca perfil do usuário
   */
  async getUserProfile(userId: string): Promise<Result<UserProfileResponse, NotFoundError>> {
    try {
      const result = await this.repository.findById(userId);

      if (result.isFailure) {
        return Result.fail(result.error as NotFoundError);
      }

      if (!result.value) {
        return Result.fail(
          new NotFoundError('Usuário', userId)
        );
      }

      const profile: UserProfileResponse = {
        username: result.value.username,
        email: result.value.email,
        nome: result.value.nome,
        telefone: result.value.telefone,
      };

      return Result.ok(profile);
    } catch (error: any) {
      return Result.fail(
        new NotFoundError('Usuário', userId)
      );
    }
  }

  /**
   * Atualiza perfil do usuário
   */
  async updateProfile(
    userId: string,
    updateData: UpdateUserProfileInput
  ): Promise<Result<UserProfileResponse, NotFoundError | ValidationError>> {
    try {
      // Se não há dados para atualizar, retorna perfil atual
      if (Object.keys(updateData).length === 0) {
        return await this.getUserProfile(userId);
      }

      const result = await this.repository.updateProfile(userId, updateData);

      if (result.isFailure) {
        return Result.fail(result.error as ValidationError | NotFoundError);
      }

      const profile: UserProfileResponse = {
        username: result.value.username,
        email: result.value.email,
        nome: result.value.nome,
        telefone: result.value.telefone,
      };

      return Result.ok(profile);
    } catch (error: any) {
      if (error instanceof ZodError) {
        const validationErrors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return Result.fail(new ValidationError(validationErrors));
      }
      return Result.fail(
        new NotFoundError('Usuário', userId)
      );
    }
  }
}
