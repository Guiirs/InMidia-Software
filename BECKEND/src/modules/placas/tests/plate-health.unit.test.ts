/**
 * Testes unitários — resolvePlateHealth()
 */

import { resolvePlateHealth } from '../utils/plate-health.utils';

const base = {
  numero_placa: 'PLT-001',
  endereco: 'Rua das Flores, 123',
  latitude: -23.5,
  longitude: -46.6,
  plateMediaResolved: true,
  regiaoId: '507f1f77bcf86cd799439011',
  statusOperacional: 'ACTIVE',
  statusComercial: 'AVAILABLE',
  disponivel: true,
};

describe('resolvePlateHealth()', () => {
  it('retorna HEALTHY (score=100) para placa completa', () => {
    const result = resolvePlateHealth(base);
    expect(result.score).toBe(100);
    expect(result.status).toBe('HEALTHY');
    expect(result.issues).toHaveLength(0);
  });

  it('detecta placa sem imagem (plateMediaResolved=false)', () => {
    const result = resolvePlateHealth({ ...base, plateMediaResolved: false });
    expect(result.issues).toContain('Possui imagem principal');
    expect(result.score).toBeLessThan(100);
  });

  it('detecta placa sem imagem quando plateMediaResolved ausente', () => {
    const result = resolvePlateHealth({ ...base, plateMediaResolved: undefined });
    expect(result.issues).toContain('Possui imagem principal');
  });

  it('detecta placa sem coordenadas', () => {
    const result = resolvePlateHealth({ ...base, latitude: undefined, longitude: undefined, coordenadas: undefined });
    expect(result.issues).toContain('Possui coordenadas');
    expect(result.score).toBeLessThan(100);
  });

  it('detecta placa sem endereço', () => {
    const result = resolvePlateHealth({ ...base, endereco: undefined, nomeDaRua: undefined, localizacao: undefined });
    expect(result.issues).toContain('Possui endereço');
  });

  it('detecta placa sem região', () => {
    const result = resolvePlateHealth({ ...base, regiaoId: undefined, regionId: undefined });
    expect(result.issues).toContain('Possui região');
  });

  it('detecta placa sem número', () => {
    const result = resolvePlateHealth({ ...base, numero_placa: '' });
    expect(result.issues).toContain('Possui número da placa');
  });

  it('retorna CRITICAL quando score < 50', () => {
    const result = resolvePlateHealth({
      numero_placa: '',
      endereco: undefined,
      latitude: undefined,
      longitude: undefined,
      plateMediaResolved: false,
      regiaoId: undefined,
    });
    expect(result.status).toBe('CRITICAL');
    expect(result.score).toBeLessThan(50);
  });

  it('retorna ATTENTION quando score entre 50-79', () => {
    // 4 de 7 critérios = 57%
    const result = resolvePlateHealth({
      numero_placa: 'X',
      endereco: 'Rua',
      latitude: -10,
      longitude: -40,
      plateMediaResolved: false,
      regiaoId: undefined,
      statusOperacional: 'ACTIVE',
    });
    expect(result.status).toBe('ATTENTION');
  });

  it('aceita coordenadas no formato string "lat,lng"', () => {
    const result = resolvePlateHealth({ ...base, latitude: undefined, longitude: undefined, coordenadas: '-23.5,-46.6' });
    expect(result.issues).not.toContain('Possui coordenadas');
  });

  it('reconhece imagem via plateMediaResolved=true', () => {
    const result = resolvePlateHealth({ ...base, plateMediaResolved: true });
    expect(result.issues).not.toContain('Possui imagem principal');
  });

  it('rejeita imagem quando plateMediaResolved=false', () => {
    const result = resolvePlateHealth({ ...base, plateMediaResolved: false });
    expect(result.issues).toContain('Possui imagem principal');
  });

  it('detecta inconsistência temporal (CONTRACTED_ACTIVE + disponivel=true)', () => {
    const result = resolvePlateHealth({ ...base, temporalStatus: 'CONTRACTED_ACTIVE', disponivel: true });
    expect(result.issues).toContain('Consistência temporal');
  });

  it('não reporta inconsistência quando disponivel=false e CONTRACTED_ACTIVE', () => {
    const result = resolvePlateHealth({ ...base, temporalStatus: 'CONTRACTED_ACTIVE', disponivel: false });
    expect(result.issues).not.toContain('Consistência temporal');
  });
});
