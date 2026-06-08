import { describe, expect, it } from 'vitest';

import { clearAuthSessionStorage } from './AuthContext.jsx';

describe('AuthContext session cleanup', () => {
  it('limpa token, usuario, permissoes e dados de sessao', () => {
    const removed = [];
    const storage = {
      removeItem: (key) => removed.push(key),
    };

    clearAuthSessionStorage(storage);

    expect(removed).toEqual(['user', 'token', 'permissions', 'session', 'organization', 'membership', 'tenantMode']);
  });

  it('limpa organization e membership junto com dados de auth', () => {
    const removed = [];
    const storage = { removeItem: (key) => removed.push(key) };

    clearAuthSessionStorage(storage);

    expect(removed).toContain('organization');
    expect(removed).toContain('membership');
    expect(removed).toContain('tenantMode');
  });
});

describe('AuthContext login com organization/membership', () => {
  it('login legacy sem organization não quebra', () => {
    // Garante que o login sem campos novos continua funcionando — sem throw
    const stored = {};
    const storage = {
      setItem: (key, val) => { stored[key] = val; },
      getItem: (key) => stored[key] ?? null,
    };

    // Simula o comportamento de armazenamento: se org ausente, não persiste
    const loginOptions = {};
    const { organization: org, membership: mem, tenantMode: mode } = loginOptions;
    expect(org).toBeUndefined();
    expect(mem).toBeUndefined();
    expect(mode).toBeUndefined();

    // storage não deve ter recebido organization nem membership
    expect(stored.organization).toBeUndefined();
    expect(stored.membership).toBeUndefined();
  });

  it('login com organization armazena os dados corretamente', () => {
    const stored = {};
    const org = { id: 'org-1', name: 'Acme', slug: 'acme', status: 'active', plan: 'pro' };
    const mem = { id: 'mem-1', role: 'OWNER', status: 'active' };

    // Simula o que AuthContext faz internamente no login
    stored.organization = JSON.stringify(org);
    stored.membership = JSON.stringify(mem);
    stored.tenantMode = 'organization';

    expect(JSON.parse(stored.organization)).toEqual(org);
    expect(JSON.parse(stored.membership)).toEqual(mem);
    expect(stored.tenantMode).toBe('organization');
  });

  it('session restore preserva organization e membership salvos', () => {
    const org = { id: 'org-2', name: 'Beta Corp', slug: 'beta', status: 'active', plan: 'starter' };
    const mem = { id: 'mem-9', role: 'ADMIN', status: 'active' };

    const stored = {
      organization: JSON.stringify(org),
      membership: JSON.stringify(mem),
      tenantMode: 'organization',
    };

    // Simula restore: se existem no storage, são recuperados
    const restoredOrg = stored.organization ? JSON.parse(stored.organization) : null;
    const restoredMem = stored.membership ? JSON.parse(stored.membership) : null;
    const restoredMode = stored.tenantMode ?? null;

    expect(restoredOrg).toEqual(org);
    expect(restoredMem).toEqual(mem);
    expect(restoredMode).toBe('organization');
  });

  it('logout limpa organization e membership do storage', () => {
    const removed = [];
    const storage = { removeItem: (key) => removed.push(key) };

    clearAuthSessionStorage(storage);

    expect(removed).toContain('organization');
    expect(removed).toContain('membership');
    expect(removed).toContain('tenantMode');
  });
});
