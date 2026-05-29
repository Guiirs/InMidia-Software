// src/services/apiClient.js
/**
 * Configuração centralizada do Axios
 * Contém apenas a instância do apiClient e interceptors
 */

import axios from 'axios';
import { API_V1_BASE_URL } from '../utils/config';
import { showToastGlobal } from '../components/ToastNotification/ToastNotification';

const isDev = import.meta.env.DEV;

if (isDev) {
  console.info(`[apiClient] Base URL em uso: ${API_V1_BASE_URL}`);
}

/* Guard contra dispatch repetido de session-expired em cascata de 403s */
let _sessionExpiredPending = false;

/* Guard para evitar múltiplos refreshes simultâneos */
let _refreshPromise = null;

/**
 * Tenta renovar o access token via /auth/refresh.
 * Se falhar, retorna null (sessão deve ser encerrada).
 */
const attemptTokenRefresh = async () => {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = axios
    .post(`${API_V1_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
    .then((res) => {
      const newToken = res.data?.data?.token;
      if (newToken) {
        localStorage.setItem('token', newToken);
      }
      return newToken || null;
    })
    .catch(() => null)
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
};

const isAuthExpiredResponse = (status, data) => {
  const code = String(data?.code || data?.errorCode || '').toUpperCase();
  if (status === 401 && code === 'TOKEN_EXPIRED') return true;

  const bodyMsg = (data?.message || data?.mensagem || data?.error || '').toLowerCase();
  return status === 401 && (
    bodyMsg.includes('sessao expirada') ||
    bodyMsg.includes('sessão expirada') ||
    bodyMsg.includes('token expirado') ||
    bodyMsg.includes('expired')
  );
};

const notifyAuthExpired = (message = 'Sua sessão expirou. Faça login novamente.') => {
  if (_sessionExpiredPending) return;
  _sessionExpiredPending = true;
  showToastGlobal(message, 'error');
  window.dispatchEvent(new CustomEvent('auth:expired', { detail: { message } }));
  window.dispatchEvent(new CustomEvent('v4:session-expired', { detail: { message } }));
  setTimeout(() => { _sessionExpiredPending = false; }, 10_000);
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const buildFinalUrl = (config = {}) => {
  try {
    return new URL(config.url || '', config.baseURL || API_V1_BASE_URL).toString();
  } catch {
    return `${config.baseURL || API_V1_BASE_URL}${config.url || ''}`;
  }
};

const getRequestContext = (config = {}) => {
  const user = readStoredUser();
  const headers = config.headers || {};

  return {
    baseURL: config.baseURL || API_V1_BASE_URL,
    url: buildFinalUrl(config),
    method: (config.method || 'get').toUpperCase(),
    authorization: Boolean(headers.Authorization || headers.authorization),
    tenantId: user?.empresaId || null,
    guildId: null,
    botId: null,
    selectedGuild: null,
    selectedServer: null,
    isPublic: Boolean(config._isPublicRequest || config.isPublic),
  };
};

// -----------------------------------------------------------------------------
// Configuração do Cliente Axios
// -----------------------------------------------------------------------------

const apiClient = axios.create({
  baseURL: API_V1_BASE_URL,
  // withCredentials envia cookies HttpOnly automaticamente (inmidia_access, inmidia_refresh)
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// -----------------------------------------------------------------------------
// Interceptors Axios (para gestão de tokens e erros)
// -----------------------------------------------------------------------------

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    config._isPublicRequest = Boolean(config.isPublic);
    
    if (token && !config.headers.Authorization && !config.isPublic) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Remove a flag isPublic antes de enviar
    delete config.isPublic;

    // Remove Content-Type para FormData (deixa o browser definir)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    if (isDev) {
      console.info('[apiClient] REQUEST', getRequestContext(config));
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    if (isDev) {
      console.info('[apiClient] RESPONSE', {
        ...getRequestContext(response.config),
        status: response.status,
        redirected: Boolean(response.request?.responseURL && response.request.responseURL !== buildFinalUrl(response.config)),
        responseURL: response.request?.responseURL || null,
      });
    }
    // Sucesso, apenas retorna a resposta
    return response;
  },
  async (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const requestUrl = error.config?.url || '';
      const isPublicRequest = Boolean(error.config?._isPublicRequest);
      const isAuthEndpoint = typeof requestUrl === 'string' && requestUrl.includes('/auth/');

      if (isDev) {
        console.error('[apiClient] ERROR_RESPONSE', {
          ...getRequestContext(error.config),
          status,
          redirected: Boolean(error.request?.responseURL && error.request.responseURL !== buildFinalUrl(error.config)),
          responseURL: error.request?.responseURL || null,
          body: data,
        });
      }

      // 401 - TOKEN_EXPIRED: tenta refresh automático antes de expirar sessão
      if (
        isAuthExpiredResponse(status, data) &&
        !isPublicRequest &&
        !isAuthEndpoint &&
        !error.config?._skipAuthRefresh &&
        !error.config?._retried
      ) {
        const newToken = await attemptTokenRefresh();
        if (newToken) {
          // Retry da requisição original com novo token
          const retryConfig = { ...error.config, _retried: true };
          retryConfig.headers = { ...retryConfig.headers, Authorization: `Bearer ${newToken}` };
          return apiClient(retryConfig);
        }
        notifyAuthExpired('Sua sessão expirou. Faça login novamente.');
        return Promise.reject(new Error('Sessão expirada. Faça login novamente.'));
      }

      // 401 que não é TOKEN_EXPIRED explícito: tenta refresh antes de declarar sessão expirada.
      // Isso evita que erros de negócio com 401 (ex: senha de confirmação errada em rotas
      // internas) sejam tratados como logout — o backend deve usar 422 para esses casos,
      // mas o interceptor adiciona defesa em profundidade.
      if (status === 401 && !isPublicRequest && !isAuthEndpoint && !error.config?._retried) {
        const newToken = await attemptTokenRefresh();
        if (newToken) {
          const retryConfig = { ...error.config, _retried: true };
          retryConfig.headers = { ...retryConfig.headers, Authorization: `Bearer ${newToken}` };
          return apiClient(retryConfig);
        }
        // Refresh falhou: sessão realmente expirada.
        notifyAuthExpired('Sua sessão expirou. Faça login novamente.');
        return Promise.reject(new Error('Sessão expirada. Faça login novamente.'));
      }

      // 403 com mensagem de token expirado — backend retorna 403 para TokenExpiredError
      if (status === 403 && !isPublicRequest && !isAuthEndpoint) {
        const bodyMsg = (data?.message || data?.mensagem || data?.error || '').toLowerCase();
        const isTokenExpiry =
          bodyMsg.includes('expirado') ||
          bodyMsg.includes('expired') ||
          bodyMsg.includes('token inv') ||
          bodyMsg.includes('jwt');
        if (isTokenExpiry) {
          notifyAuthExpired('Sua sessão expirou. Faça login novamente.');
          return Promise.reject(new Error('Sessão expirada. Faça login novamente.'));
        }
      }

      let errorMessage = 'Ocorreu um erro desconhecido.';
      let errorData = data;

      // Tratamento especial para Blobs (PDFs/Excel com erro)
      if (data instanceof Blob) {
        if (data.type === 'application/json' || data.type.includes('json')) {
          try {
            const errorText = await data.text();
            errorData = JSON.parse(errorText);
            errorMessage = errorData?.message || 'Erro ao processar o arquivo.';
          } catch (e) {
            console.error('[apiClient] Erro ao parsear blob JSON:', e);
            errorMessage = 'Erro ao ler a resposta de erro (formato JSON inválido).';
          }
        } else {
          errorMessage = `Erro: Recebido arquivo do tipo "${data.type}" ao invés de JSON.`;
          console.error('[apiClient] Blob recebido com tipo não-JSON:', data.type);
        }
      } else if (data) {
        const validationMessage = Array.isArray(data?.errors)
          ? data.errors[0]?.message || data.errors[0]?.msg
          : undefined;
        errorMessage =
          data?.message ||
          data?.mensagem ||
          data?.error ||
          validationMessage ||
          error.message ||
          `Erro ${status}`;
      }

      // Mensagens específicas por código HTTP — nunca silencia nem converte em “manutenção”
      // “Manutenção” só aparece se a API retornar flag explícita (ex: data.maintenanceMode === true)
      if (!errorMessage || errorMessage === 'Ocorreu um erro desconhecido.') {
        switch (status) {
          case 400: errorMessage = 'Requisição inválida. Verifique os dados enviados.'; break;
          case 403: errorMessage = 'Acesso negado. Sem permissão para esta ação.'; break;
          case 404: errorMessage = 'Recurso não encontrado.'; break;
          case 409: errorMessage = 'Conflito: o recurso já existe ou está em uso.'; break;
          case 422: errorMessage = 'Dados inválidos. Verifique o formulário.'; break;
          case 429: errorMessage = 'Muitas requisições. Aguarde um momento e tente novamente.'; break;
          case 500: errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.'; break;
          case 502: case 503: case 504:
            errorMessage = 'Servidor temporariamente indisponível. Tente novamente em breve.'; break;
          default: errorMessage = `Erro ${status}.`;
        }
      }

      const enhancedError = new Error(errorMessage);
      enhancedError.response = error.response;
      enhancedError.response.data = errorData;
      enhancedError.statusCode = status;

      return Promise.reject(enhancedError);

    } else if (error.request) {
      if (isDev) {
        console.error('[apiClient] NO_RESPONSE', {
          ...getRequestContext(error.config),
          canceled: axios.isCancel(error) || error.code === 'ERR_CANCELED',
          corsOrNetwork: true,
          code: error.code || null,
          message: error.message,
        });
      }
      // Erros de rede/CORS nunca viram “manutenção” — são erros de conectividade
      if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
        return Promise.reject(new Error('Requisição cancelada.'));
      }
      return Promise.reject(new Error('Não foi possível conectar ao servidor. Verifique a sua conexão.'));
    } else {
      if (isDev) {
        console.error('[apiClient] CONFIG_ERROR', error.message);
      }
      return Promise.reject(new Error('Erro ao preparar a requisição: ' + error.message));
    }
  }
);

export default apiClient;



