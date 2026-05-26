import apiClient from './apiClient.js';
import { API_BASE_URL } from '../utils/config.js';

function ensurePath(path) {
  return path.startsWith('/') ? path : `/${path}`;
}

function toApiVersionBase(version = 'v4') {
  return API_BASE_URL
    .replace(/\/api\/v\d+$/i, `/api/${version}`)
    .replace(/\/api$/i, `/api/${version}`);
}

export function v4Base(path) {
  return `${toApiVersionBase('v4')}${ensurePath(path)}`;
}

export function v1Base(path) {
  return `${toApiVersionBase('v1')}${ensurePath(path)}`;
}

export function dataOf(response) {
  return response?.data?.data ?? response?.data;
}

function normalizeHttpError(error, operation, requestPath) {
  const status = error?.statusCode ?? error?.response?.status ?? null;
  const messageByStatus = {
    401: 'Nao autorizado para acessar recurso v4.',
    403: 'Acesso negado no recurso v4.',
    404: 'Recurso v4 nao encontrado.',
    500: 'Falha interna ao acessar recurso v4.',
  };

  const wrapped = new Error(
    error?.message
    || messageByStatus[status]
    || `Falha na operacao ${operation}.`
  );
  wrapped.statusCode = status;
  wrapped.operation = operation;
  wrapped.requestPath = requestPath;
  wrapped.cause = error;
  return wrapped;
}

function hasMockSignature(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const source = String(payload.source ?? '').toLowerCase();
  return source === 'mock' || source === 'fallback';
}

export function ensureNoProductionMock(payload, operation) {
  if (import.meta.env.PROD && hasMockSignature(payload)) {
    throw new Error(`Payload mock/fallback bloqueado em producao: ${operation}.`);
  }
  return payload;
}

export async function requestFirstAvailable(method, paths, { operation, params, data, config } = {}) {
  const list = Array.isArray(paths) ? paths : [paths];
  let lastError = null;

  for (const path of list) {
    try {
      const response = await apiClient.request({
        method,
        url: path,
        params,
        data,
        ...(config ?? {}),
      });
      return dataOf(response);
    } catch (error) {
      const status = error?.statusCode ?? error?.response?.status;
      if (status === 404 || status === 405) {
        lastError = normalizeHttpError(error, operation, path);
        continue;
      }
      throw normalizeHttpError(error, operation, path);
    }
  }

  throw (lastError ?? new Error(`Nenhum endpoint disponivel para ${operation}.`));
}

export async function requestV4(method, path, { operation, params, data, config } = {}) {
  return requestFirstAvailable(method, [v4Base(path)], { operation, params, data, config });
}
