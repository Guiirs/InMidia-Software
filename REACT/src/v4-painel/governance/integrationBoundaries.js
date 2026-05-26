export const HARD_BOUNDARIES = [
  {
    id: 'NO_DIRECT_API',
    rule: 'Nenhum componente v4-painel pode chamar fetch(), axios ou apiClient diretamente.',
    rationale: 'Chamadas de rede pertencem aos adapters do Sync Core ou services V4 dedicados.',
    enforcement: 'check:sync-boundaries',
    violation: 'BLOQUEANTE',
  },
  {
    id: 'NO_PRODUCTION_PREVIEW',
    rule: 'Preview tecnico, devtools e rotas de engenharia nao podem aparecer no menu produtivo.',
    rationale: 'Tenant comum deve ver apenas paginas LIVE/FULL.',
    enforcement: 'pageRegistry.test.js',
    violation: 'BLOQUEANTE',
  },
  {
    id: 'NO_PRODUCTION_MOCK_RUNTIME',
    rule: 'Shell produtivo deve usar auth/session, readiness, Sync Core, feature flags e realtime reais.',
    rationale: 'Canario depende de sinais operacionais reais.',
    enforcement: 'pageRegistry.test.js',
    violation: 'BLOQUEANTE',
  },
];

export const SOFT_BOUNDARIES = [
  {
    id: 'PREFER_CSS_VARS',
    rule: 'Preferir variaveis CSS (--v4p-*) a valores hardcoded.',
    rationale: 'Garante consistencia com o design system.',
    enforcement: 'Code review',
    violation: 'AVISO',
  },
  {
    id: 'USE_OPERATIONAL_LANGUAGE',
    rule: 'Usar linguagem operacional na UI.',
    rationale: 'O produto e para gestores e operadores.',
    enforcement: 'Code review',
    violation: 'AVISO',
  },
];

export const INTEGRATION_RULES = [
  {
    id: 'SYNC_CORE_ONLY',
    description: 'Dados operacionais devem passar pelo Sync Core.',
    pattern: 'API V4 -> service V4 -> adapter Sync Core -> provider/pagina',
    interface: 'Resources e mutations registrados em src/core/sync-core/adapters',
  },
  {
    id: 'FEATURE_FLAG_GATE',
    description: 'Rollout deve ser controlado por feature flag real.',
    pattern: 'Flag desativada = rota indisponivel; flag ativada = painel real',
    interface: 'featuresAdapter + /api/v4/features',
  },
  {
    id: 'CONTRACT_FIRST',
    description: 'Contrato de dados deve existir antes de nova superficie V4.',
    pattern: 'Contrato aprovado -> backend implementa -> adapter conecta -> UI permanece intacta',
    interface: 'BECKEND/docs/V4_FRONTEND_ENDPOINT_MATRIX.md',
  },
];

export const ALLOWED_IMPORTS = {
  'v4-painel/*': [
    'react',
    'react/jsx-runtime',
    '../foundation/**',
    '../styles/**',
    '../providers/**',
    '../design-system/**',
    '../shell/**',
    '../components/**',
    '../pages/**',
    '../governance/**',
  ],
  'providers/*': [
    'react',
    '../foundation/**',
    '../../core/sync-core/**',
    '../../services/*V4Service.js',
    '../../services/systemReadinessService.js',
  ],
};

export const ARCHITECTURAL_APPROVAL = {
  requiredFor: [
    'Qualquer import de fora do diretorio v4-painel/ que nao esteja no Sync Core/services V4',
    'Mudancas em foundation/ que afetam tokens',
    'Mudancas em AppShell que afetam layout ou permissao',
    'Ativacao de feature flag para beta ou full',
  ],
  approvers: ['Tech Lead', 'Product Owner'],
  process: 'Pull Request com label "v4-architectural" e revisao obrigatoria.',
};
