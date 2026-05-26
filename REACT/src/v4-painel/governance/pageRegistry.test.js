import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  INTEGRATION_STATUS,
  PAGE_REGISTRY,
  PAGE_STATUS,
} from './pageRegistry.js';

const MENU_PAGE_IDS = [
  'dashboard',
  'operacoes',
  'inventario',
  'regioes',
  'comercial',
  'contratos',
  'campanhas',
  'relatorios',
  'alertas',
  'atividade',
];

const menuPages = PAGE_REGISTRY.filter((p) => MENU_PAGE_IDS.includes(p.id));

describe('pageRegistry - consistencia V4', () => {
  it('todas as 10 paginas do menu estao registradas', () => {
    expect(menuPages).toHaveLength(10);
  });

  it('todas as 10 paginas do menu sao LIVE', () => {
    const notLive = menuPages.filter((p) => p.status !== PAGE_STATUS.LIVE);
    expect(notLive.map((p) => `${p.label}: ${p.status}`)).toEqual([]);
  });

  it('todas as 10 paginas do menu tem integration FULL', () => {
    const notFull = menuPages.filter((p) => p.integration !== INTEGRATION_STATUS.FULL);
    expect(notFull.map((p) => `${p.label}: ${p.integration}`)).toEqual([]);
  });

  it('nenhuma pagina do menu tem mockFile diferente de null', () => {
    const withMock = menuPages.filter((p) => p.mockFile !== null);
    expect(withMock.map((p) => `${p.label}: ${p.mockFile}`)).toEqual([]);
  });

  it('nenhuma pagina do menu tem contractFile diferente de null', () => {
    const withContract = menuPages.filter((p) => p.contractFile !== null);
    expect(withContract.map((p) => `${p.label}: ${p.contractFile}`)).toEqual([]);
  });

  it('registry operacional nao contem paginas ComingSoon ou configuracoes', () => {
    expect(PAGE_REGISTRY).toHaveLength(10);
    expect(PAGE_REGISTRY.some((p) => p.status === PAGE_STATUS.COMING_SOON)).toBe(false);
    expect(PAGE_REGISTRY.some((p) => p.id === 'configuracoes')).toBe(false);
  });

  it('shell V4 nao carrega runtime mockado, preview ou ComingSoon', () => {
    const source = readFileSync(new URL('../V4Painel.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/MockRuntimeProvider|V4PreviewPage|ComingSoonPage|CONFIGURACOES/);
    expect(source).toMatch(/RuntimeProvider/);
  });

  it('AppShell usa sessao real e nao importa usuario mockado', () => {
    const source = readFileSync(new URL('../shell/AppShell.jsx', import.meta.url), 'utf8');
    expect(source).toMatch(/useSyncResource\('users\.session'\)/);
    expect(source).not.toMatch(/MOCK_USER|navigationMock|userMock/);
  });

  it('Topbar usa inventory.regions real e periodos de producao', () => {
    const source = readFileSync(new URL('../shell/Topbar.jsx', import.meta.url), 'utf8');
    expect(source).toMatch(/useSyncResource\('inventory\.regions'\)/);
    expect(source).not.toMatch(/MOCK_REGIONS|MOCK_PERIODS|userMock/);
  });

  it('navegacao produtiva nao expoe preview tecnico', () => {
    const source = readFileSync(new URL('../foundation/navigation.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/CONFIGURACOES|coming_soon|Configura/);
    expect(source).toMatch(/permission: 'dashboard\.read'/);
  });

  it('rotas legadas de preview V4 nao entram no bundle produtivo', () => {
    const source = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/\.\/v4\/preview|\.\/v4\/routes\/InventoryV4Route|V4PreviewPage|InventoryV4Route/);
  });

  it('smoke canario usa realtime V4', () => {
    const source = readFileSync(new URL('../../../../BECKEND/scripts/v4-canary-smoke-test.js', import.meta.url), 'utf8');
    expect(source).toMatch(/\/api\/v4\/realtime\/stream-token/);
    expect(source).toMatch(/\/api\/v4\/realtime\/health/);
    expect(source).not.toMatch(/\/api\/v1\/sync\/stream-token/);
  });

  it('DashboardPage nao importa dashboardMockData em producao', () => {
    const page = readFileSync(new URL('../pages/dashboard/DashboardPage.jsx', import.meta.url), 'utf8');
    expect(page).not.toMatch(/dashboardMockData/);
  });

  it('InventoryPage nao importa inventoryMockData em producao', () => {
    const page = readFileSync(new URL('../pages/inventory/InventoryPage.jsx', import.meta.url), 'utf8');
    expect(page).not.toMatch(/inventoryMockData/);
  });

  it('ContractsPage nao importa contractsMockData em producao', () => {
    const page = readFileSync(new URL('../pages/contracts/ContractsPage.jsx', import.meta.url), 'utf8');
    expect(page).not.toMatch(/contractsMockData/);
  });

  it('MapPage nao importa mock nem preview/ComingSoon', () => {
    const page = readFileSync(new URL('../pages/map/MapPage.jsx', import.meta.url), 'utf8');
    expect(page).not.toMatch(/MockData|mockData|ComingSoon|preview/);
    expect(page).toMatch(/useSyncResource/);
  });

  it('dashboard/index.js nao re-exporta dashboardMockData', () => {
    const idx = readFileSync(new URL('../pages/dashboard/index.js', import.meta.url), 'utf8');
    expect(idx).not.toMatch(/dashboardMockData/);
  });

  it('inventory/index.js nao re-exporta inventoryMockData', () => {
    const idx = readFileSync(new URL('../pages/inventory/index.js', import.meta.url), 'utf8');
    expect(idx).not.toMatch(/inventoryMockData/);
  });
});
