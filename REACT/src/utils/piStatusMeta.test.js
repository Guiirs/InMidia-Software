import { describe, expect, it } from 'vitest';
import { getPIStatusMeta } from './piStatusMeta.js';

describe('getPIStatusMeta', () => {
  // ── V4.1 canonical ──────────────────────────────────────────────────────

  it('traduz DRAFT para Rascunho', () => {
    const meta = getPIStatusMeta('DRAFT');
    expect(meta.label).toBe('Rascunho');
    expect(meta.cssClass).toBe('draft');
  });

  it('traduz PENDING_APPROVAL para Pendente de aprovação', () => {
    const meta = getPIStatusMeta('PENDING_APPROVAL');
    expect(meta.label).toBe('Pendente de aprovação');
    expect(meta.cssClass).toBe('pending-approval');
  });

  it('traduz APPROVED para Aprovada', () => {
    const meta = getPIStatusMeta('APPROVED');
    expect(meta.label).toBe('Aprovada');
    expect(meta.cssClass).toBe('approved');
  });

  it('traduz REJECTED para Rejeitada', () => {
    const meta = getPIStatusMeta('REJECTED');
    expect(meta.label).toBe('Rejeitada');
    expect(meta.cssClass).toBe('rejected');
  });

  it('traduz CONTRACT_GENERATED para Contrato gerado', () => {
    const meta = getPIStatusMeta('CONTRACT_GENERATED');
    expect(meta.label).toBe('Contrato gerado');
    expect(meta.cssClass).toBe('contract-generated');
  });

  it('traduz CANCELLED para Cancelada', () => {
    const meta = getPIStatusMeta('CANCELLED');
    expect(meta.label).toBe('Cancelada');
    expect(meta.cssClass).toBe('cancelled');
  });

  // ── Legacy ───────────────────────────────────────────────────────────────

  it('traduz em_andamento para Em andamento', () => {
    const meta = getPIStatusMeta('em_andamento');
    expect(meta.label).toBe('Em andamento');
    expect(meta.cssClass).toBe('em-andamento');
  });

  it('traduz concluida para Concluída', () => {
    const meta = getPIStatusMeta('concluida');
    expect(meta.label).toBe('Concluída');
    expect(meta.cssClass).toBe('concluida');
  });

  it('traduz vencida para Vencida', () => {
    const meta = getPIStatusMeta('vencida');
    expect(meta.label).toBe('Vencida');
    expect(meta.cssClass).toBe('vencida');
  });

  // ── Unknown / fallback ───────────────────────────────────────────────────

  it('retorna fallback para status desconhecido', () => {
    const meta = getPIStatusMeta('WEIRD_STATUS');
    expect(meta.label).toBe('WEIRD_STATUS');
    expect(meta.cssClass).toBe('unknown');
  });

  it('retorna fallback seguro para status undefined', () => {
    const meta = getPIStatusMeta(undefined);
    expect(meta.label).toBe('—');
    expect(meta.cssClass).toBe('unknown');
  });

  it('retorna fallback seguro para status null', () => {
    const meta = getPIStatusMeta(null);
    expect(meta.label).toBe('—');
    expect(meta.cssClass).toBe('unknown');
  });
});
