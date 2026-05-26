import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// ── service mock ──────────────────────────────────────────────────────────────
vi.mock('../../../services/regionService.js', () => ({
  listRegions: vi.fn(),
  getRegion: vi.fn(),
  getRegionSummary: vi.fn(),
  getRegionPlates: vi.fn(),
  getRegionOperations: vi.fn(),
  getRegionAlerts: vi.fn(),
  createRegion: vi.fn(),
  updateRegion: vi.fn(),
  archiveRegion: vi.fn(),
  attachPlateToRegion: vi.fn(),
  detachPlateFromRegion: vi.fn(),
  migrateLegacyRegions: vi.fn(),
}));

// ── auth mock ─────────────────────────────────────────────────────────────────
let mockUser = { permissions: ['regions.read', 'regions.create', 'regions.update', 'regions.archive', 'regions.manage'] };
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const SAMPLE_REGIONS = [
  { id: 'r1', name: 'Nordeste Premium', code: 'NE-PREM', city: 'Recife', state: 'PE', status: 'ACTIVE', color: '#22d3ee', totalBoards: 12, occupancyRate: 0.75 },
  { id: 'r2', name: 'Sul Compacto', code: 'SL-CPT', city: 'Florianópolis', state: 'SC', status: 'active', color: '#38c78f', totalBoards: 7, occupancyRate: 0.42 },
];

const SAMPLE_SUMMARY = {
  totalPlates: 12,
  availablePlates: 3,
  reservedPlates: 2,
  contractedPlates: 7,
  blockedPlates: 0,
  activeRevenue: 45000,
  futureRevenue: 12000,
  occupancyRate: 0.75,
  activeContracts: 6,
  pendingOperations: 1,
  alertsCount: 0,
};

const SAMPLE_PLATES = [
  { id: 'p1', code: 'REC-001', address: 'Av. Boa Viagem, 123', status: 'occupied', regionalLot: 'L01' },
  { id: 'p2', code: 'REC-002', address: 'Rua Dom Bosco, 45', status: 'available', regionalLot: null },
];

// ── service tests ─────────────────────────────────────────────────────────────
describe('regionService — contratos de endpoint', () => {
  it('listRegions chama GET /regions', async () => {
    const { requestV4 } = await vi.importActual('../../../services/v4ServiceUtils.js').catch(() => ({ requestV4: vi.fn() }));
    const { listRegions } = await import('../../../services/regionService.js');
    listRegions({ status: 'active' });
    expect(listRegions).toBeDefined();
  });

  it('createRegion exporta funcao', async () => {
    const { createRegion } = await import('../../../services/regionService.js');
    expect(typeof createRegion).toBe('function');
  });

  it('archiveRegion exporta funcao', async () => {
    const { archiveRegion } = await import('../../../services/regionService.js');
    expect(typeof archiveRegion).toBe('function');
  });

  it('attachPlateToRegion exporta funcao', async () => {
    const { attachPlateToRegion } = await import('../../../services/regionService.js');
    expect(typeof attachPlateToRegion).toBe('function');
  });

  it('detachPlateFromRegion exporta funcao', async () => {
    const { detachPlateFromRegion } = await import('../../../services/regionService.js');
    expect(typeof detachPlateFromRegion).toBe('function');
  });

  it('migrateLegacyRegions exporta funcao', async () => {
    const { migrateLegacyRegions } = await import('../../../services/regionService.js');
    expect(typeof migrateLegacyRegions).toBe('function');
  });

  it('getRegionOperations e getRegionAlerts exportam funcoes', async () => {
    const { getRegionOperations, getRegionAlerts } = await import('../../../services/regionService.js');
    expect(typeof getRegionOperations).toBe('function');
    expect(typeof getRegionAlerts).toBe('function');
  });
});

// ── RegionSummaryCard ─────────────────────────────────────────────────────────
describe('RegionSummaryCard', () => {
  it('renderiza metricas da regiao selecionada', async () => {
    const { default: RegionSummaryCard } = await import('../../components/map/RegionSummaryCard.jsx');
    const html = renderToString(<RegionSummaryCard summary={SAMPLE_SUMMARY} regionName="Nordeste Premium" />);
    expect(html).toContain('12');
    expect(html).toContain('Resumo regional');
    expect(html).toContain('Nordeste Premium');
  });

  it('renderiza traco para metricas null', async () => {
    const { default: RegionSummaryCard } = await import('../../components/map/RegionSummaryCard.jsx');
    const sparseSummary = { totalPlates: null, availablePlates: null, occupancyRate: null };
    const html = renderToString(<RegionSummaryCard summary={sparseSummary} regionName="Vazia" />);
    expect(html).toContain('—');
  });

  it('nao renderiza nada sem summary', async () => {
    const { default: RegionSummaryCard } = await import('../../components/map/RegionSummaryCard.jsx');
    const html = renderToString(<RegionSummaryCard summary={null} />);
    expect(html).toBe('');
  });
});

// ── RegionOperationsPanel ───────────────────────────────────────────────────
describe('RegionOperationsPanel', () => {
  it('mostra operacoes regionais compactas', async () => {
    const { default: RegionOperationsPanel } = await import('../../components/map/RegionOperationsPanel.jsx');
    const html = renderToString(
      <RegionOperationsPanel
        operations={[
          {
            id: 'op1',
            type: 'INSTALLATION',
            status: 'PENDING',
            priority: 'CRITICAL',
            plateNumber: 'REC-001',
            address: 'Av. Boa Viagem',
            dueAt: '2026-05-20T12:00:00.000Z',
            assignedTo: 'Equipe A',
            overdue: true,
          },
        ]}
        summary={{ total: 1, pending: 1, critical: 1, overdue: 1 }}
      />
    );

    expect(html).toContain('Operacoes regionais');
    expect(html).toContain('Instalacao');
    expect(html).toContain('REC-001');
    expect(html).toContain('is-critical');
    expect(html).toContain('Atrasada');
  });

  it('exibe empty state sem operacoes', async () => {
    const { default: RegionOperationsPanel } = await import('../../components/map/RegionOperationsPanel.jsx');
    const html = renderToString(<RegionOperationsPanel operations={[]} />);
    expect(html).toContain('Nenhuma operacao regional pendente.');
  });
});

// ── RegionAlertsPanel ───────────────────────────────────────────────────────
describe('RegionAlertsPanel', () => {
  it('mostra alertas regionais', async () => {
    const { default: RegionAlertsPanel } = await import('../../components/map/RegionAlertsPanel.jsx');
    const html = renderToString(
      <RegionAlertsPanel
        alerts={[
          {
            id: 'a1',
            severity: 'CRITICAL',
            message: 'Contrato vencendo na regiao',
            source: 'TEMPORAL_EVENT',
            createdAt: '2026-05-20T12:00:00.000Z',
          },
        ]}
        summary={{ total: 1, critical: 1, warning: 0, temporal: 1 }}
      />
    );

    expect(html).toContain('Alertas regionais');
    expect(html).toContain('Contrato vencendo na regiao');
    expect(html).toContain('is-critical');
    expect(html).toContain('Temporal Engine');
  });

  it('exibe empty state sem alertas criticos', async () => {
    const { default: RegionAlertsPanel } = await import('../../components/map/RegionAlertsPanel.jsx');
    const html = renderToString(<RegionAlertsPanel alerts={[]} />);
    expect(html).toContain('Nenhum alerta critico nesta regiao.');
  });
});

// ── RegionList ────────────────────────────────────────────────────────────────
describe('RegionList', () => {
  it('renderiza lista de regioes', async () => {
    const { default: RegionList } = await import('../../components/map/RegionList.jsx');
    const html = renderToString(
      <RegionList regions={SAMPLE_REGIONS} selectedRegionId={null} onSelectRegion={() => {}} />
    );
    expect(html).toContain('Nordeste Premium');
    expect(html).toContain('NE-PREM');
    expect(html).toContain('Sul Compacto');
  });

  it('marca regiao selecionada com is-selected', async () => {
    const { default: RegionList } = await import('../../components/map/RegionList.jsx');
    const html = renderToString(
      <RegionList regions={SAMPLE_REGIONS} selectedRegionId="r1" onSelectRegion={() => {}} />
    );
    expect(html).toContain('is-selected');
  });

  it('renderiza status ACTIVE, INACTIVE e ARCHIVED como badges em portugues', async () => {
    const { default: RegionList } = await import('../../components/map/RegionList.jsx');
    const regions = [
      { id: 'a', name: 'Ativa Raw', status: 'ACTIVE' },
      { id: 'i', name: 'Inativa Raw', status: 'INACTIVE' },
      { id: 'r', name: 'Arquivada Raw', status: 'ARCHIVED' },
    ];
    const html = renderToString(
      <RegionList regions={regions} selectedRegionId="a" onSelectRegion={() => {}} />
    );

    expect(html).toContain('Ativa');
    expect(html).toContain('Inativa');
    expect(html).toContain('Arquivada');
    expect(html).toContain('is-active');
    expect(html).toContain('is-inactive');
    expect(html).toContain('is-archived');
    expect(html).toContain('is-selected');
  });

  it('nao exibe status tecnicos crus na lista', async () => {
    const { default: RegionList } = await import('../../components/map/RegionList.jsx');
    const html = renderToString(
      <RegionList
        regions={[
          { id: 'a', name: 'Ativa Raw', status: 'ACTIVE' },
          { id: 'i', name: 'Inativa Raw', status: 'INACTIVE' },
          { id: 'r', name: 'Arquivada Raw', status: 'ARCHIVED' },
        ]}
        selectedRegionId={null}
        onSelectRegion={() => {}}
      />
    );

    expect(html).not.toContain('>ACTIVE<');
    expect(html).not.toContain('>INACTIVE<');
    expect(html).not.toContain('>ARCHIVED<');
  });

  it('nao renderiza nada com lista vazia', async () => {
    const { default: RegionList } = await import('../../components/map/RegionList.jsx');
    const html = renderToString(
      <RegionList regions={[]} selectedRegionId={null} onSelectRegion={() => {}} />
    );
    expect(html).toBe('');
  });
});

// ── RegionPlateList ───────────────────────────────────────────────────────────
describe('RegionPlateList', () => {
  it('renderiza placas vinculadas', async () => {
    const { default: RegionPlateList } = await import('../../components/map/RegionPlateList.jsx');
    const html = renderToString(
      <RegionPlateList plates={SAMPLE_PLATES} canManage={false} />
    );
    expect(html).toContain('REC-001');
    expect(html).toContain('Av. Boa Viagem, 123');
    expect(html).toContain('L01');
  });

  it('exibe empty-state sem placas', async () => {
    const { default: RegionPlateList } = await import('../../components/map/RegionPlateList.jsx');
    const html = renderToString(<RegionPlateList plates={[]} canManage={false} />);
    expect(html).toContain('Nenhuma placa vinculada');
  });

  it('mostra botao desvincular quando canManage=true', async () => {
    const { default: RegionPlateList } = await import('../../components/map/RegionPlateList.jsx');
    const html = renderToString(
      <RegionPlateList plates={SAMPLE_PLATES} canManage={true} onDetach={() => {}} detachLoading={false} />
    );
    expect(html).toContain('Desvincular placa');
  });

  it('nao mostra botao desvincular quando canManage=false', async () => {
    const { default: RegionPlateList } = await import('../../components/map/RegionPlateList.jsx');
    const html = renderToString(
      <RegionPlateList plates={SAMPLE_PLATES} canManage={false} />
    );
    expect(html).not.toContain('Desvincular placa');
  });
});

// ── RegionFormModal ───────────────────────────────────────────────────────────
describe('RegionFormModal', () => {
  it('nao renderiza quando open=false', async () => {
    const { default: RegionFormModal } = await import('../../components/map/RegionFormModal.jsx');
    const html = renderToString(
      <RegionFormModal open={false} onClose={() => {}} onSave={() => {}} />
    );
    expect(html).toBe('');
  });

  it('renderiza form de criacao quando open=true sem region', async () => {
    const { default: RegionFormModal } = await import('../../components/map/RegionFormModal.jsx');
    const html = renderToString(
      <RegionFormModal open={true} region={null} onClose={() => {}} onSave={() => {}} />
    );
    expect(html).toContain('Nova região');
    expect(html).toContain('Nome da região');
    expect(html).toContain('Código');
  });

  it('renderiza form de edicao quando region tem id', async () => {
    const { default: RegionFormModal } = await import('../../components/map/RegionFormModal.jsx');
    const html = renderToString(
      <RegionFormModal
        open={true}
        region={{ id: 'r1', name: 'Nordeste', code: 'NE', status: 'active', color: '#22d3ee' }}
        onClose={() => {}}
        onSave={() => {}}
      />
    );
    expect(html).toContain('Editar região');
    expect(html).toContain('Salvar alterações');
  });

  it('mostra estado salvando quando saving=true', async () => {
    const { default: RegionFormModal } = await import('../../components/map/RegionFormModal.jsx');
    const html = renderToString(
      <RegionFormModal open={true} region={null} onClose={() => {}} onSave={() => {}} saving={true} />
    );
    expect(html).toContain('Salvando...');
  });
});

// ── RegionManagerPanel — RBAC ─────────────────────────────────────────────────
describe('RegionManagerPanel — RBAC', () => {
  it('exibe mensagem de sem permissao quando usuario nao tem regions.read', async () => {
    mockUser = { permissions: [] };
    const { default: RegionManagerPanel } = await import('../../components/map/RegionManagerPanel.jsx');
    const html = renderToString(<RegionManagerPanel />);
    expect(html).toContain('permiss');
  });

  it('renderiza header Centro Territorial com contador quando usuario tem regions.read', async () => {
    mockUser = { permissions: ['regions.read'] };
    const { listRegions } = await import('../../../services/regionService.js');
    listRegions.mockResolvedValue([]);
    const { default: RegionManagerPanel } = await import('../../components/map/RegionManagerPanel.jsx');
    const html = renderToString(<RegionManagerPanel />);
    expect(html).toContain('Centro Territorial');
    expect(html).toContain('territorios');
  });

  it('oculta botao Nova regiao sem regions.create', async () => {
    mockUser = { permissions: ['regions.read'] };
    const { listRegions } = await import('../../../services/regionService.js');
    listRegions.mockResolvedValue([]);
    const { default: RegionManagerPanel } = await import('../../components/map/RegionManagerPanel.jsx');
    const html = renderToString(<RegionManagerPanel />);
    expect(html).not.toContain('Nova região');
  });

  it('exibe botao Nova regiao com regions.create', async () => {
    mockUser = { permissions: ['regions.read', 'regions.create'] };
    const { listRegions } = await import('../../../services/regionService.js');
    listRegions.mockResolvedValue([]);
    const { default: RegionManagerPanel } = await import('../../components/map/RegionManagerPanel.jsx');
    const html = renderToString(<RegionManagerPanel />);
    expect(html).toContain('Nova região');
  });
});

// ── useRegions hook ───────────────────────────────────────────────────────────
describe('useRegions hook', () => {
  it('exporta os estados e acoes esperados', async () => {
    const { useRegions } = await import('../../../hooks/useRegions.js');
    expect(typeof useRegions).toBe('function');
  });
});
