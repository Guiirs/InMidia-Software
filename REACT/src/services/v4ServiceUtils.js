import apiClient from './apiClient.js';
import {
  API_V1_BASE_URL,
  API_V4_BASE_URL,
  buildApiRequest,
  buildApiV1Request,
  buildApiV4Request,
} from '../utils/config.js';

function ensurePath(path) {
  return path.startsWith('/') ? path : `/${path}`;
}

export function v4Base(path) {
  return `${API_V4_BASE_URL}${ensurePath(path)}`;
}

export function v1Base(path) {
  return `${API_V1_BASE_URL}${ensurePath(path)}`;
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
    const requestConfig = normalizeRequestConfig(path, config);

    try {
      const response = await apiClient.request({
        method,
        params,
        data,
        ...requestConfig,
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
  return requestFirstAvailable(method, [path], {
    operation, params, data,
    config: { ...buildApiV4Request(path), ...(config ?? {}) },
  });
}

function normalizeRequestConfig(path, config) {
  if (config?.baseURL && config?.url) {
    return { ...config };
  }

  if (config?.baseURL) {
    return {
      ...config,
      url: ensurePath(path),
    };
  }

  if (typeof path === 'string' && /\/api\/v4(?=\/|$)|\/v4(?=\/|$)/i.test(path)) {
    return {
      ...buildApiV4Request(path),
      ...(config ?? {}),
    };
  }

  if (typeof path === 'string' && /\/api\/v1(?=\/|$)|\/v1(?=\/|$)/i.test(path)) {
    return {
      ...buildApiV1Request(path),
      ...(config ?? {}),
    };
  }

  return {
    ...buildApiRequest(path),
    ...(config ?? {}),
  };
}
