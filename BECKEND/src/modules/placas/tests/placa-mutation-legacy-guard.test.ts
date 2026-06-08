/**
 * placa-mutation-legacy-guard.test.ts — FASE 10
 *
 * Garante que o layer de DTO/schema nunca persiste campos de imagem legados
 * a partir de mutation payloads.
 *
 * Campos bloqueados para persistência via API:
 *   imagemPrincipal, imagem (string), foto, fotoUrl, imageUrl
 *
 * Exceção legítima:
 *   imagem: null  → sinal de remoção de imagem (preservado para service layer)
 */

import { validateUpdatePlaca, validateCreatePlaca } from '../dtos/placa.dto';

// ── Helpers ────────────────────────────────────────────────────────────────────

function baseCreate() {
  return {
    numero_placa: 'CAU-37',
    regiaoId: '507f1f77bcf86cd799439011',
    disponivel: true,
  };
}

function baseUpdate() {
  return { nomeDaRua: 'Rua Nova' };
}

// ── UPDATE: campos legados de imagem são stripped ──────────────────────────────

describe('validateUpdatePlaca — campos de imagem legados são stripped', () => {
  it('imagemPrincipal string é removido do payload', () => {
    const result = validateUpdatePlaca({ ...baseUpdate(), imagemPrincipal: 'empresas/e1/plates/p1/main.jpg' });
    expect(result).not.toHaveProperty('imagemPrincipal');
  });

  it('imagem string é removido do payload', () => {
    const result = validateUpdatePlaca({ ...baseUpdate(), imagem: 'empresas/e1/plates/p1/main.jpg' });
    expect(result).not.toHaveProperty('imagem');
  });

  it('imageUrl string é removido do payload', () => {
    const result = validateUpdatePlaca({ ...baseUpdate(), imageUrl: 'https://example.com/img.jpg' });
    expect(result).not.toHaveProperty('imageUrl');
  });

  it('foto é removido do payload (campo nunca aceito)', () => {
    const result = validateUpdatePlaca({ ...baseUpdate(), foto: 'empresas/e1/plates/p1/foto.jpg' });
    expect(result).not.toHaveProperty('foto');
  });

  it('fotoUrl é removido do payload (campo nunca aceito)', () => {
    const result = validateUpdatePlaca({ ...baseUpdate(), fotoUrl: 'https://example.com/foto.jpg' });
    expect(result).not.toHaveProperty('fotoUrl');
  });

  it('r2Key direta é removida do payload', () => {
    const result = validateUpdatePlaca({ ...baseUpdate(), r2Key: 'empresas/e1/plates/p1/main.jpg' });
    expect(result).not.toHaveProperty('r2Key');
  });

  it('storageKey direta é removida do payload', () => {
    const result = validateUpdatePlaca({ ...baseUpdate(), storageKey: 'empresas/e1/plates/p1/main.jpg' });
    expect(result).not.toHaveProperty('storageKey');
  });

  it('payload misto: campos legados são stripped, campos válidos preservados', () => {
    const result = validateUpdatePlaca({
      nomeDaRua: 'Rua Nova',
      imagemPrincipal: 'legacy-key.jpg',
      imagem: 'another-legacy.jpg',
      foto: 'foto.jpg',
      fotoUrl: 'https://example.com/foto.jpg',
      imageUrl: 'https://example.com/img.jpg',
    });
    expect(result).not.toHaveProperty('imagemPrincipal');
    expect(result).not.toHaveProperty('imagem');
    expect(result).not.toHaveProperty('foto');
    expect(result).not.toHaveProperty('fotoUrl');
    expect(result).not.toHaveProperty('imageUrl');
    // Campo legítimo preservado
    expect((result as any).nomeDaRua).toBe('Rua Nova');
  });
});

// ── UPDATE: imagem: null é sinal de remoção legítimo ─────────────────────────

describe('validateUpdatePlaca — imagem: null é sinal de remoção preservado', () => {
  it('imagem: null é preservado no payload (sinal de remoção para service layer)', () => {
    const result = validateUpdatePlaca({ imagem: null }) as any;
    expect(result).toHaveProperty('imagem', null);
  });

  it('imagemPrincipal: null é removido (remoção só via imagem: null)', () => {
    // imagemPrincipal foi removido do schema — qualquer valor (inclusive null) é stripped
    const result = validateUpdatePlaca({ imagemPrincipal: null }) as any;
    expect(result).not.toHaveProperty('imagemPrincipal');
  });
});

// ── CREATE: campos de imagem são sempre stripped ──────────────────────────────

describe('validateCreatePlaca — campos de imagem nunca aparecem na criação', () => {
  it('imagemPrincipal string não cria campo na entidade', () => {
    const result = validateCreatePlaca({ ...baseCreate(), imagemPrincipal: 'key/img.jpg' });
    expect(result).not.toHaveProperty('imagemPrincipal');
  });

  it('imagem string não cria campo na entidade', () => {
    const result = validateCreatePlaca({ ...baseCreate(), imagem: 'key/img.jpg' });
    expect(result).not.toHaveProperty('imagem');
  });

  it('foto não cria campo na entidade', () => {
    const result = validateCreatePlaca({ ...baseCreate(), foto: 'key/foto.jpg' });
    expect(result).not.toHaveProperty('foto');
  });

  it('fotoUrl não cria campo na entidade', () => {
    const result = validateCreatePlaca({ ...baseCreate(), fotoUrl: 'https://example.com/foto.jpg' });
    expect(result).not.toHaveProperty('fotoUrl');
  });
});
