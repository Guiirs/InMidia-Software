/**
 * Teste de integridade das permissoes dos adapters Sync Core.
 *
 * Verifica que:
 * 1. Nenhuma permissao generica *.write existe nos adapters
 * 2. Todas as permissoes seguem o formato canonico domain.action
 * 3. Todas as permissoes declaradas existem na matriz canonica produtiva
 */

import { PERMISSIONS }       from '../../../auth/permissions.js';
import { contractsAdapter }  from './contracts.adapter.js';
import { alertsAdapter }     from './alerts.adapter.js';
import { commercialAdapter } from './commercial.adapter.js';
import { operationsAdapter } from './operations.adapter.js';
import { reportsAdapter }    from './reports.adapter.js';
import { inventoryAdapter }  from './inventory.adapter.js';
import { dashboardAdapter }  from './dashboard.adapter.js';

const V4_CANONICAL_PERMISSIONS = new Set(Object.values(PERMISSIONS));

const ADAPTERS = [
  { name: 'contracts',  adapter: contractsAdapter  },
  { name: 'alerts',     adapter: alertsAdapter     },
  { name: 'commercial', adapter: commercialAdapter },
  { name: 'operations', adapter: operationsAdapter },
  { name: 'reports',    adapter: reportsAdapter    },
  { name: 'inventory',  adapter: inventoryAdapter  },
  { name: 'dashboard',  adapter: dashboardAdapter  },
];

function collectPermissions(adapter) {
  const perms = new Set();

  if (Array.isArray(adapter.permissions)) {
    adapter.permissions.forEach((permission) => perms.add(permission));
  }

  if (Array.isArray(adapter.resources)) {
    adapter.resources.forEach((resource) => {
      if (Array.isArray(resource.permissions)) {
        resource.permissions.forEach((permission) => perms.add(permission));
      }
    });
  }

  if (Array.isArray(adapter.mutations)) {
    adapter.mutations.forEach((mutation) => {
      if (Array.isArray(mutation.permissions)) {
        mutation.permissions.forEach((permission) => perms.add(permission));
      }
    });
  }

  return perms;
}

describe('Adapter permissions integrity', () => {
  it('nenhum adapter usa permissao generica *.write', () => {
    for (const { name, adapter } of ADAPTERS) {
      const perms = collectPermissions(adapter);
      for (const permission of perms) {
        expect(permission).not.toMatch(/\.write$/, `Adapter "${name}" ainda usa "${permission}" - substituir por granular`);
      }
    }
  });

  it('todas as permissoes seguem formato domain.action', () => {
    for (const { name, adapter } of ADAPTERS) {
      const perms = collectPermissions(adapter);
      for (const permission of perms) {
        expect(permission).toMatch(
          /^[a-z]+\.[a-z]+$/,
          `Adapter "${name}": permissao "${permission}" nao segue o formato domain.action`
        );
      }
    }
  });

  it('todas as permissoes existem na matriz canonica produtiva', () => {
    for (const { name, adapter } of ADAPTERS) {
      const perms = collectPermissions(adapter);
      for (const permission of perms) {
        expect(V4_CANONICAL_PERMISSIONS.has(permission)).toBe(
          true,
          `Adapter "${name}": permissao "${permission}" nao existe na matriz canonica produtiva`
        );
      }
    }
  });

  it('inventory adapter usa permissoes granulares por mutation', () => {
    const mutations = inventoryAdapter.mutations ?? [];
    const mutationPerms = mutations.flatMap((mutation) => mutation.permissions ?? []);

    expect(mutationPerms).toContain('inventory.create');
    expect(mutationPerms).toContain('inventory.update');
    expect(mutationPerms).toContain('inventory.delete');
    expect(mutationPerms).not.toContain('inventory.write');
  });

  it('contracts adapter usa permissoes granulares por mutation', () => {
    const mutations = contractsAdapter.mutations ?? [];
    const mutationPerms = mutations.flatMap((mutation) => mutation.permissions ?? []);

    expect(mutationPerms).toContain('contracts.create');
    expect(mutationPerms).toContain('contracts.update');
    expect(mutationPerms).toContain('contracts.cancel');
    expect(mutationPerms).toContain('contracts.renew');
    expect(mutationPerms).not.toContain('contracts.write');
  });

  it('alerts adapter usa permissoes granulares por mutation', () => {
    const mutations = alertsAdapter.mutations ?? [];
    const mutationPerms = mutations.flatMap((mutation) => mutation.permissions ?? []);

    expect(mutationPerms).toContain('alerts.update');
    expect(mutationPerms).toContain('alerts.resolve');
    expect(mutationPerms).toContain('alerts.dismiss');
    expect(mutationPerms).toContain('alerts.create');
    expect(mutationPerms).not.toContain('alerts.write');
  });

  it('commercial adapter usa permissoes granulares por mutation', () => {
    const mutations = commercialAdapter.mutations ?? [];
    const mutationPerms = mutations.flatMap((mutation) => mutation.permissions ?? []);

    expect(mutationPerms).toContain('commercial.create');
    expect(mutationPerms).toContain('commercial.update');
    expect(mutationPerms).toContain('commercial.convert');
    expect(mutationPerms).not.toContain('commercial.write');
  });

  it('operations adapter usa permissoes granulares por mutation', () => {
    const mutations = operationsAdapter.mutations ?? [];
    const mutationPerms = mutations.flatMap((mutation) => mutation.permissions ?? []);

    expect(mutationPerms).toContain('operations.create');
    expect(mutationPerms).toContain('operations.update');
    expect(mutationPerms).toContain('operations.complete');
    expect(mutationPerms).toContain('operations.assign');
    expect(mutationPerms).not.toContain('operations.write');
  });

  it('reports adapter usa reports.export e reports.schedule', () => {
    const mutations = reportsAdapter.mutations ?? [];
    const mutationPerms = mutations.flatMap((mutation) => mutation.permissions ?? []);

    expect(mutationPerms).toContain('reports.export');
    expect(mutationPerms).toContain('reports.schedule');
    expect(mutationPerms).not.toContain('reports.write');
  });
});
