import { describe, expect, it } from 'vitest';

import {
  API_BASE_URL,
  buildApiV1Request,
  buildApiV1Url,
  buildApiV4Request,
  buildApiV4Url,
} from './api.js';

describe('api config routing helpers', () => {
  it('mantem a base oficial em /api e deriva requests versionados sem duplicar prefixo', () => {
    expect(API_BASE_URL).toBe('/api');
    expect(buildApiV1Url('/clientes')).toBe('/api/v1/clientes');
    expect(buildApiV4Url('/operations/timeline')).toBe('/api/v4/operations/timeline');
  });

  it('transforma caminhos versionados em baseURL raiz + url relativa da versao', () => {
    expect(buildApiV1Request('/api/v1/placas')).toEqual({
      baseURL: '/api',
      url: '/v1/placas',
    });

    expect(buildApiV4Request('/api/v4/system/readiness')).toEqual({
      baseURL: '/api',
      url: '/v4/system/readiness',
    });
  });

  it('normaliza caminhos relativos e absolutas same-origin sem duplicar prefixos de versao', () => {
    expect(buildApiV4Request('/v4/operations/tasks')).toEqual({
      baseURL: '/api',
      url: '/v4/operations/tasks',
    });

    expect(buildApiV4Request('https://inmidia.futureoutdoors.com.br/api/v4/operations/by-domain')).toEqual({
      baseURL: '/api',
      url: '/v4/operations/by-domain',
    });
  });
});
