/**
 * Result Pattern - Type-Safe Error Handling
 * 
 * Substitui try-catch genéricos por um sistema tipado que força
 * o tratamento de erros em tempo de compilação.
 * 
 * @example
 * ```typescript
 * // Ao invés de:
 * try {
 *   const user = await getUser(id);
 *   return user;
 * } catch (error) {
 *   throw new Error(error.message);
 * }
 * 
 * // Use:
 * const result = await getUser(id);
 * if (result.isFailure) {
 *   return result.error; // Erro tipado
 * }
 * return result.value; // Valor tipado
 * ```
 */

/**
 * Result<T, E> - Representa o resultado de uma operação que pode falhar
 */
export class Result<T, E = Error> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E
  ) {
    // Garante que apenas um dos dois existe
    if (_isSuccess && _error !== undefined) {
      throw new Error('Result: Success não pode ter erro');
    }
    if (!_isSuccess && _value !== undefined) {
      throw new Error('Result: Failure não pode ter valor');
    }
  }

  /**
   * Cria um Result de sucesso
   */
  static ok<U, F = Error>(value: U): Result<U, F> {
    return new Result<U, F>(true, value, undefined);
  }

  /**
   * Cria um Result de falha
   */
  static fail<U, F = Error>(error: F): Result<U, F> {
    return new Result<U, F>(false, undefined, error);
  }

  /**
   * Cria Result a partir de uma Promise
   */
  static async fromPromise<U, F = Error>(
    promise: Promise<U>,
    errorMapper?: (error: unknown) => F
  ): Promise<Result<U, F>> {
    try {
      const value = await promise;
      return Result.ok(value);
    } catch (error) {
      const mappedError = errorMapper ? errorMapper(error) : (error as F);
      return Result.fail(mappedError);
    }
  }

  /**
   * Combina múltiplos Results (todos devem ser sucesso)
   */
  static combine<T, E = Error>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail(result.error);
      }
      values.push(result.value);
    }
    
    return Result.ok(values);
  }

  /**
   * Retorna o primeiro sucesso ou o último erro
   */
  static firstSuccess<T, E = Error>(results: Result<T, E>[]): Result<T, E> {
    let lastError: E | undefined;
    
    for (const result of results) {
      if (result.isSuccess) {
        return result;
      }
      lastError = result.error;
    }
    
    return Result.fail(lastError!);
  }

  // ============================================
  // GETTERS
  // ============================================

  get isSuccess(): boolean {
    return this._isSuccess;
  }

  get isFailure(): boolean {
    return !this._isSuccess;
  }

  get value(): T {
    if (!this._isSuccess) {
      throw new Error('Cannot get value from failure Result');
    }
    return this._value!;
  }

  get error(): E {
    if (this._isSuccess) {
      throw new Error('Cannot get error from success Result');
    }
    return this._error!;
  }

  /**
   * Retorna o valor ou undefined se for failure
   */
  get valueOrUndefined(): T | undefined {
    return this._isSuccess ? this._value : undefined;
  }

  /**
   * Retorna o valor ou um valor padrão
   */
  getValueOr(defaultValue: T): T {
    return this._isSuccess ? this._value! : defaultValue;
  }

  // ============================================
  // TRANSFORMAÇÕES
  // ============================================

  /**
   * Mapeia o valor de sucesso
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isFailure) {
      return Result.fail(this.error);
    }
    return Result.ok(fn(this.value));
  }

  /**
   * Mapeia o erro
   */
  mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (this.isSuccess) {
      return Result.ok(this.value);
    }
    return Result.fail(fn(this.error));
  }

  /**
   * Chain assíncrono (flatMap)
   */
  async andThen<U>(fn: (value: T) => Promise<Result<U, E>>): Promise<Result<U, E>> {
    if (this.isFailure) {
      return Result.fail(this.error);
    }
    return fn(this.value);
  }

  /**
   * Executa função apenas se for sucesso
   */
  onSuccess(fn: (value: T) => void): Result<T, E> {
    if (this.isSuccess) {
      fn(this.value);
    }
    return this;
  }

  /**
   * Executa função apenas se for failure
   */
  onFailure(fn: (error: E) => void): Result<T, E> {
    if (this.isFailure) {
      fn(this.error);
    }
    return this;
  }

  /**
   * Match pattern (switch para Result)
   */
  match<U>(patterns: {
    ok: (value: T) => U;
    fail: (error: E) => U;
  }): U {
    return this.isSuccess ? patterns.ok(this.value) : patterns.fail(this.error);
  }

  /**
   * Converte para Promise (lança erro se failure)
   */
  async toPromise(): Promise<T> {
    if (this.isFailure) {
      throw this.error;
    }
    return this.value;
  }

  /**
   * Converte para JSON
   */
  toJSON(): { success: boolean; value?: T; error?: E } {
    return {
      success: this.isSuccess,
      value: this.valueOrUndefined,
      error: this.isFailure ? this.error : undefined
    };
  }
}

/**
 * Helper type para extrair o tipo de valor de um Result
 */
export type UnwrapResult<R> = R extends Result<infer T, any> ? T : never;

/**
 * Helper type para extrair o tipo de erro de um Result
 */
export type UnwrapError<R> = R extends Result<any, infer E> ? E : never;
