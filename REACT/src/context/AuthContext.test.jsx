import { describe, expect, it } from 'vitest';

import { clearAuthSessionStorage } from './AuthContext.jsx';

describe('AuthContext session cleanup', () => {
  it('limpa token, usuario, permissoes e dados de sessao', () => {
    const removed = [];
    const storage = {
      removeItem: (key) => removed.push(key),
    };

    clearAuthSessionStorage(storage);

    expect(removed).toEqual(['user', 'token', 'permissions', 'session']);
  });
});
