import { isPublicCorsPath } from '@shared/infra/http/cors-policy';

describe('public/private CORS boundary', () => {
  it('classifica apenas prefixes publicos para CORS wildcard', () => {
    expect(isPublicCorsPath('/api/v1/public/placas')).toBe(true);
    expect(isPublicCorsPath('/api/public/placas/123/imagem')).toBe(true);
    expect(isPublicCorsPath('/public/v1/inventory')).toBe(true);
  });

  it('nao classifica API privada como CORS publico', () => {
    expect(isPublicCorsPath('/api/v1/private/placas')).toBe(false);
    expect(isPublicCorsPath('/api/v1/private/public/placas')).toBe(false);
    expect(isPublicCorsPath('/api/v4/inventory')).toBe(false);
  });
});
