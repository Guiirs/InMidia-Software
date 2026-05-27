/**
 * Auth Repository - Camada de acesso a dados
 */

import { Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { Result, InvalidCredentialsError, NotFoundError } from '@shared/core';
import type { IUser } from '../../../types/models';

export interface IAuthRepository {
  /**
   * Busca usuários candidatos ao login por username ou email (com senha)
   */
  findLoginUsers(usernameOrEmail: string): Promise<Result<IUser[], NotFoundError>>;

  /**
   * Busca usuário por ID (com senha)
   */
  findByIdWithPassword(id: string): Promise<Result<IUser | null, NotFoundError>>;

  /**
   * Busca usuário por email
   */
  findByEmail(email: string): Promise<Result<IUser | null, NotFoundError>>;

  /**
   * Verifica senha do usuário
   */
  verifyPassword(hashedPassword: string, plainPassword: string): Promise<Result<boolean, InvalidCredentialsError>>;

  /**
   * Atualiza senha do usuário
   */
  updatePassword(userId: string, newPassword: string): Promise<Result<void, NotFoundError>>;

  /**
   * Salva hash do reset token e data de expiração
   */
  saveResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<Result<void, NotFoundError>>;

  /**
   * Busca usuário pelo hash do reset token (inclui tokenExpiry)
   */
  findByResetTokenHash(tokenHash: string): Promise<Result<IUser | null, NotFoundError>>;

  /**
   * Limpa o reset token após uso ou expiração
   */
  clearResetToken(userId: string): Promise<Result<void, NotFoundError>>;
}

export class AuthRepository implements IAuthRepository {
  constructor(private readonly model: Model<IUser>) {}

  async findLoginUsers(usernameOrEmail: string): Promise<Result<IUser[], NotFoundError>> {
    try {
      const normalizedInput = String(usernameOrEmail || '').trim();
      const normalizedEmail = normalizedInput.toLowerCase();

      const users = await this.model
        .find({
          $or: [
            { username: normalizedInput },
            { email: normalizedEmail }
          ]
        })
        .select('+senha +password')
        .lean<IUser[]>()
        .exec();

      return Result.ok(users);
    } catch (error: any) {
      return Result.fail(
        new NotFoundError('Usuário', usernameOrEmail)
      );
    }
  }

  async findByIdWithPassword(id: string): Promise<Result<IUser | null, NotFoundError>> {
    try {
      const user = await this.model
        .findById(id)
        .select('+senha +password')
        .exec();

      return Result.ok(user);
    } catch (error: any) {
      return Result.fail(
        new NotFoundError('Usuário', id)
      );
    }
  }

  async findByEmail(email: string): Promise<Result<IUser | null, NotFoundError>> {
    try {
      const user = await this.model
        .findOne({ email: email.toLowerCase() })
        .lean<IUser | null>()
        .exec();

      return Result.ok(user);
    } catch (error: any) {
      return Result.fail(
        new NotFoundError('Usuário', email)
      );
    }
  }

  async verifyPassword(hashedPassword: string, plainPassword: string): Promise<Result<boolean, InvalidCredentialsError>> {
    try {
      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      return Result.ok(isMatch);
    } catch (error: any) {
      return Result.fail(new InvalidCredentialsError());
    }
  }

  async updatePassword(userId: string, newPassword: string): Promise<Result<void, NotFoundError>> {
    try {
      const user = await this.model.findById(userId).exec();

      if (!user) {
        return Result.fail(new NotFoundError('Usuário', userId));
      }

      // Password será hasheado pelo pre-save hook
      const userDoc = user as any;
      if (userDoc.senha !== undefined) {
        userDoc.senha = newPassword;
      } else {
        userDoc.password = newPassword;
      }

      await user.save();
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(new NotFoundError('Usuário', userId));
    }
  }

  async saveResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<Result<void, NotFoundError>> {
    try {
      await this.model.updateOne(
        { _id: userId },
        { resetToken: tokenHash, tokenExpiry: expiresAt }
      ).exec();
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(new NotFoundError('Usuário', userId));
    }
  }

  async findByResetTokenHash(tokenHash: string): Promise<Result<IUser | null, NotFoundError>> {
    try {
      const user = await this.model
        .findOne({ resetToken: tokenHash })
        .select('+resetToken tokenExpiry')
        .exec();
      return Result.ok(user);
    } catch (error: any) {
      return Result.fail(new NotFoundError('Usuário', 'resetToken'));
    }
  }

  async clearResetToken(userId: string): Promise<Result<void, NotFoundError>> {
    try {
      await this.model.updateOne(
        { _id: userId },
        { $unset: { resetToken: '', tokenExpiry: '' } }
      ).exec();
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(new NotFoundError('Usuário', userId));
    }
  }
}
