import express from 'express';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import privateApiRoutes from './private-api.routes';
import {
  isPublicPathForbiddenInPrivateApi,
  PRIVATE_API_MOUNTS,
  PRIVATE_API_SENSITIVE_RESPONSE_KEYS,
} from './private-api.contract';
import { PublicInventoryPresenter } from '@modules/public-api/presenters/public-inventory.presenter';
import { findRoute } from '@gateway/gateway.config';
import { getModuleByName } from '@gateway/module-registry';

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    keys.add(key);
    collectKeys(child, keys);
  });
  return keys;
}

describe('private/public API boundary', () => {
  function readModuleFiles(moduleName: string): string {
    const root = path.join(process.cwd(), 'src', 'modules', moduleName);
    const files: string[] = [];
    const visit = (dir: string) => {
      fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(fullPath);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(fullPath);
      });
    };
    visit(root);
    return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  }

  it('registra /api/v1/private como modulo canonico privado no gateway', () => {
    expect(getModuleByName('private-api')?.basePath).toBe('/api/v1/private');
    expect(findRoute('/api/v1/private/inventory/boards')).toEqual(
      expect.objectContaining({ module: 'private-api', requiresAuth: true }),
    );
  });

  it('nao cria dependencia de API publica para API privada', () => {
    const publicApiSource = `${readModuleFiles('public-api')}\n${readModuleFiles('public-plates')}`;

    expect(publicApiSource).not.toContain('@modules/private-api');
    expect(publicApiSource).not.toContain('../private-api');
  });

  it('nao monta API publica dentro do modulo privado', () => {
    const privateApiSource = readModuleFiles('private-api');

    expect(privateApiSource).not.toContain('@modules/public-api/public-api.routes');
    expect(privateApiSource).not.toContain('@modules/public-api/public-api-v1.routes');
    expect(privateApiSource).not.toContain('@modules/public-plates/public-plates.routes');
  });

  it('bloqueia acesso indevido sem JWT na API privada', async () => {
    const app = express();
    app.use('/api/v1/private', privateApiRoutes);

    const res = await request(app).get('/api/v1/private/_meta');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('nao monta recursos publicos dentro da API privada', () => {
    expect(isPublicPathForbiddenInPrivateApi('/public/placas')).toBe(true);
    expect(isPublicPathForbiddenInPrivateApi('/api/v1/public/placas')).toBe(true);
    expect(isPublicPathForbiddenInPrivateApi('/placas')).toBe(false);
    expect(PRIVATE_API_MOUNTS.map((mount) => mount.path)).not.toContain('/public');
  });

  it('mantem metadados de tenant em rotas privadas conhecidas', () => {
    const paths = new Set(PRIVATE_API_MOUNTS.map((mount) => mount.path));

    expect(paths).toContain('/inventory');
    expect(paths).toContain('/contracts');
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/operations');
    expect(paths).toContain('/commercial');
  });

  it('presenter publico nao propaga campos privados sensiveis', () => {
    const payload = PublicInventoryPresenter.item({
      item: {
        placaId: '64f000000000000000000123',
        numeroPlaca: 'ABC-123',
        numeroOperacional: 12,
        regiaoId: '64f000000000000000000456',
        coordinates: { latitude: -23.5, longitude: -46.6 },
        availability: { status: 'available', available: true },
        status: { physical: 'active', commercial: 'available', operational: 'active' },
        empresaId: 'tenant-secret',
        token: 'secret-token',
      } as any,
      source: {
        nomeDaRua: 'Rua Publica',
        tamanho: '9x3',
        regiaoNome: 'Centro',
        imagem: undefined,
        apiKey: 'secret-api-key',
        r2Key: 'private/key.jpg',
      } as any,
    });

    const keys = collectKeys(payload);
    PRIVATE_API_SENSITIVE_RESPONSE_KEYS.forEach((key) => {
      expect(keys).not.toContain(key);
    });
    expect(keys).not.toContain('empresaId');
    expect(keys).not.toContain('placaId');
  });
});
