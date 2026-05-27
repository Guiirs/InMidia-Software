import { DomainError } from '@shared/core';

export class UserWithoutEmpresaError extends DomainError {
  readonly code = 'USER_WITHOUT_EMPRESA';
  readonly statusCode = 403;

  constructor(userId?: string) {
    super(
      userId
        ? `Usuario ${userId} nao possui empresa vinculada.`
        : 'Usuario nao possui empresa vinculada.'
    );
  }
}

export class EmpresaNotFoundForUserError extends DomainError {
  readonly code = 'EMPRESA_NOT_FOUND_FOR_USER';
  readonly statusCode = 403;

  constructor(empresaId: string, userId?: string) {
    super(
      userId
        ? `Empresa ${empresaId} vinculada ao usuario ${userId} nao foi encontrada.`
        : `Empresa ${empresaId} vinculada ao usuario nao foi encontrada.`
    );
  }
}

export class DuplicatedEmailUsersError extends DomainError {
  readonly code = 'DUPLICATED_EMAIL_USERS';
  readonly statusCode = 409;

  constructor(email: string) {
    super(`Mais de um usuario ativo foi encontrado com o email ${email}.`);
  }
}

export class TenantContextInconsistentError extends DomainError {
  readonly code = 'TENANT_CONTEXT_INCONSISTENT';
  readonly statusCode = 403;

  constructor(message = 'Tenant inconsistente entre autenticacao e sessao.') {
    super(message);
  }
}

export class EmpresaNotFoundForTokenError extends DomainError {
  readonly code = 'EMPRESA_NOT_FOUND_FOR_TOKEN';
  readonly statusCode = 403;

  constructor(empresaId: string) {
    super(`Empresa ${empresaId} informada no token nao foi encontrada.`);
  }
}
