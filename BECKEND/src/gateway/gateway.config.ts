/**
 * API Gateway Configuration
 */

export interface ServiceRoute {
  path: string;
  target: string;
  module: string;
  requiresAuth: boolean;
  requiresApiKey?: boolean;
  requiredRoles?: string[];
  rateLimit?: {
    windowMs: number;
    max: number;
    useRedisStore?: boolean;
  };
}

export interface GatewayConfig {
  routes: ServiceRoute[];
  defaultTimeout: number;
  circuitBreaker: {
    threshold: number;
    timeout: number;
  };
}

export const gatewayConfig: GatewayConfig = {
  defaultTimeout: 30000,

  circuitBreaker: {
    threshold: 5,
    timeout: 60000,
  },

  routes: [
    // CORE DOMAIN (AutenticaÃ§Ã£o & Empresas)
    {
      path: '/api/v1/auth/*',
      target: 'local',
      module: 'auth',
      requiresAuth: false,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 10,
      },
    },
    {
      path: '/api/v1/empresas/*',
      target: 'local',
      module: 'empresas',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100,
      },
    },
    {
      path: '/api/v1/empresa/*',
      target: 'local',
      module: 'empresa-alias',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100,
      },
    },
    // both singular and plural are accepted to avoid mismatch between
    // frontend requests and historical builds. the plural form existed in
    // earlier releases, so keeping both patterns prevents 401s if a stale
    // dist/ was deployed by mistake.
    {
      path: '/api/v1/user/*',
      target: 'local',
      module: 'users',
      requiresAuth: true,
    },
    {
      path: '/api/v1/users/*',
      target: 'local',
      module: 'users',
      requiresAuth: true,
    },
    {
      path: '/api/v1/admin/*',
      target: 'local',
      module: 'admin',
      requiresAuth: true,
      requiredRoles: ['admin', 'superadmin'],
    },

    // ASSET MANAGEMENT (Placas & Regiões)
    {
      path: '/api/v1/placas/*',
      target: 'local',
      module: 'placas',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 500,
      },
    },
    {
      path: '/api/v1/regioes/*',
      target: 'local',
      module: 'regioes',
      requiresAuth: true,
    },

    // CRM DOMAIN (Clientes & AluguÃ©is)
    {
      path: '/api/v1/clientes/*',
      target: 'local',
      module: 'clientes',
      requiresAuth: true,
    },
    {
      path: '/api/v1/alugueis/*',
      target: 'local',
      module: 'alugueis',
      requiresAuth: true,
    },

    // SALES & CONTRACTS (PIs & Contratos)
    {
      path: '/api/v1/pis/*/download',
      target: 'local',
      module: 'propostas-internas',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 20,
      },
    },
    {
      path: '/api/v1/pis/*/download-excel',
      target: 'local',
      module: 'propostas-internas',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 20,
      },
    },
    {
      path: '/api/v1/pis/*/pdf-template',
      target: 'local',
      module: 'propostas-internas',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 20,
      },
    },
    {
      path: '/api/v1/pis/*',
      target: 'local',
      module: 'propostas-internas',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 200,
      },
    },
    {
      path: '/api/v1/contratos/*/download',
      target: 'local',
      module: 'contratos',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 20,
      },
    },
    {
      path: '/api/v1/contratos/*/excel',
      target: 'local',
      module: 'contratos',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 20,
      },
    },
    {
      path: '/api/v1/contratos/*/pdf-excel',
      target: 'local',
      module: 'contratos',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 20,
      },
    },
    {
      path: '/api/v1/contratos/*/pdf-template',
      target: 'local',
      module: 'contratos',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 20,
      },
    },
    {
      path: '/api/v1/contratos/*',
      target: 'local',
      module: 'contratos',
      requiresAuth: true,
    },
    {
      path: '/api/v1/bi-weeks/*',
      target: 'local',
      module: 'biweeks',
      requiresAuth: true,
    },

    // INTEGRATION LAYER (Webhooks & APIs)
    {
      path: '/api/v1/webhooks/*',
      target: 'local',
      module: 'webhooks',
      requiresAuth: true,
    },
    {
      path: '/api/v1/public/*',
      target: 'local',
      module: 'public-api',
      requiresAuth: false,
      requiresApiKey: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100,
      },
    },
    {
      path: '/public/v1/*',
      target: 'local',
      module: 'public-api-v1',
      requiresAuth: false,
      requiresApiKey: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100,
      },
    },
    {
      path: '/api/v1/sse/*',
      target: 'local',
      module: 'sse',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 120,
      },
    },
    {
      path: '/api/v1/whatsapp/*',
      target: 'local',
      module: 'whatsapp',
      requiresAuth: true,
    },

    // ANALYTICS & REPORTS
    {
      path: '/api/v1/relatorios/export/*',
      target: 'local',
      module: 'relatorios',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 20,
      },
    },
    {
      path: '/api/v1/relatorios/*',
      target: 'local',
      module: 'relatorios',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 50,
      },
    },
    {
      path: '/api/v4/inventory/*',
      target: 'local',
      module: 'inventory-v4',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 300,
      },
    },
    {
      path: '/api/v1/inventory/*',
      target: 'local',
      module: 'inventory-v1-alias',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 300,
      },
    },
    {
      path: '/api/v4/realtime/stream',
      target: 'local',
      module: 'realtime-v4-stream',
      requiresAuth: false,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 600,
      },
    },
    {
      path: '/api/v4/realtime/*',
      target: 'local',
      module: 'realtime-v4',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 600,
      },
    },
    {
      path: '/api/v4/system/*',
      target: 'local',
      module: 'system-v4',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 120,
      },
    },
    {
      path: '/api/v1/marketplace/*',
      target: 'local',
      module: 'marketplace',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 80,
      },
    },

    // RBAC — listagem de roles e permissões
    {
      path: '/api/v1/rbac/*',
      target: 'local',
      module: 'rbac',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 60,
      },
    },

    // SYSTEM & HEALTH
    {
      path: '/api/v1/health',
      target: 'local',
      module: 'system',
      requiresAuth: false,
    },
    {
      path: '/api/v1/queue/jobs/*/download',
      target: 'local',
      module: 'queue',
      requiresAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        max: 40,
      },
    },
    {
      path: '/api/v1/system/*',
      target: 'local',
      module: 'system',
      requiresAuth: true,
    },
  ],
};

export function findRoute(path: string): ServiceRoute | undefined {
  return gatewayConfig.routes.find(route => {
    const pattern = route.path.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(path);
  });
}

export function isModuleEnabled(_moduleName: string): boolean {
  return true;
}
