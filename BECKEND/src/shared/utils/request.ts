/**
 * Helpers tipados para Express 5.
 *
 * Express 5 mudou req.query e req.params para retornar tipos mais amplos:
 *   req.params[x] → string | string[]  (antes era apenas string)
 *   req.query[x]  → string | string[] | ParsedQs | ParsedQs[]
 *
 * Estes helpers encapsulam o narrowing repetitivo e tornam o código
 * dos controllers mais seguro sem precisar de `as string` espalhado.
 */

import { Request } from 'express';

/**
 * Retorna um parâmetro de rota como string.
 * req.params nunca produz arrays em rotas normais — o cast é seguro.
 */
export const getParam = (req: Request, name: string): string | undefined => {
  const val = req.params[name];
  if (!val) return undefined;
  return Array.isArray(val) ? val[0] : (val as string);
};

/**
 * Retorna um query param como string.
 * Se o parâmetro foi repetido na URL (?a=1&a=2), retorna o primeiro valor.
 */
export const getQuery = (req: Request, name: string): string | undefined => {
  const val = req.query[name];
  if (!val) return undefined;
  if (Array.isArray(val)) return val[0] as string | undefined;
  if (typeof val === 'object') return undefined; // ParsedQs — ignorado
  return val as string;
};

/**
 * Converte um valor de query/param para string de forma segura.
 * Uso: asStr(req.query.empresaId) || empresaId
 */
export const asStr = (val: unknown): string | undefined => {
  if (!val) return undefined;
  if (Array.isArray(val)) return val[0] as string | undefined;
  if (typeof val === 'string') return val;
  return undefined;
};
