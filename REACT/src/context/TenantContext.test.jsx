// src/context/TenantContext.test.jsx
import { describe, expect, it } from 'vitest';
import { computeTenantValues } from './TenantContext.jsx';

const ORG = { id: 'org-1', name: 'Acme', slug: 'acme', status: 'active', plan: 'pro' };
const MEM_OWNER = { id: 'mem-1', role: 'OWNER', status: 'active' };
const MEM_ADMIN = { id: 'mem-2', role: 'ADMIN', status: 'active' };
const MEM_VIEWER = { id: 'mem-3', role: 'VIEWER', status: 'active' };

describe('computeTenantValues', () => {
  describe('modo organização (OWNER)', () => {
    const auth = { organization: ORG, membership: MEM_OWNER, tenantMode: 'organization' };

    it('hasOrganization é true', () => {
      expect(computeTenantValues(auth).hasOrganization).toBe(true);
    });

    it('isOwner é true', () => {
      expect(computeTenantValues(auth).isOwner).toBe(true);
    });

    it('isAdmin é true para OWNER', () => {
      expect(computeTenantValues(auth).isAdmin).toBe(true);
    });

    it('canManageOrganization é true para OWNER', () => {
      expect(computeTenantValues(auth).canManageOrganization).toBe(true);
    });

    it('canInviteMembers é true para OWNER', () => {
      expect(computeTenantValues(auth).canInviteMembers).toBe(true);
    });

    it('isLegacyMode é false', () => {
      expect(computeTenantValues(auth).isLegacyMode).toBe(false);
    });

    it('role é "OWNER"', () => {
      expect(computeTenantValues(auth).role).toBe('OWNER');
    });

    it('expõe organization e membership', () => {
      const result = computeTenantValues(auth);
      expect(result.organization).toEqual(ORG);
      expect(result.membership).toEqual(MEM_OWNER);
    });
  });

  describe('modo organização (ADMIN)', () => {
    const auth = { organization: ORG, membership: MEM_ADMIN, tenantMode: 'organization' };

    it('isAdmin é true', () => {
      expect(computeTenantValues(auth).isAdmin).toBe(true);
    });

    it('isOwner é false', () => {
      expect(computeTenantValues(auth).isOwner).toBe(false);
    });

    it('canManageOrganization é false para ADMIN', () => {
      expect(computeTenantValues(auth).canManageOrganization).toBe(false);
    });

    it('canInviteMembers é true para ADMIN', () => {
      expect(computeTenantValues(auth).canInviteMembers).toBe(true);
    });
  });

  describe('modo organização (VIEWER)', () => {
    const auth = { organization: ORG, membership: MEM_VIEWER, tenantMode: 'organization' };

    it('isAdmin é false', () => {
      expect(computeTenantValues(auth).isAdmin).toBe(false);
    });

    it('isOwner é false', () => {
      expect(computeTenantValues(auth).isOwner).toBe(false);
    });

    it('canManageOrganization é false para VIEWER', () => {
      expect(computeTenantValues(auth).canManageOrganization).toBe(false);
    });

    it('canInviteMembers é false para VIEWER', () => {
      expect(computeTenantValues(auth).canInviteMembers).toBe(false);
    });
  });

  describe('modo legado (sem organização)', () => {
    const auth = { organization: null, membership: null, tenantMode: null };

    it('hasOrganization é false', () => {
      expect(computeTenantValues(auth).hasOrganization).toBe(false);
    });

    it('isLegacyMode é true', () => {
      expect(computeTenantValues(auth).isLegacyMode).toBe(true);
    });

    it('isOwner é false', () => {
      expect(computeTenantValues(auth).isOwner).toBe(false);
    });

    it('canManageOrganization é false', () => {
      expect(computeTenantValues(auth).canManageOrganization).toBe(false);
    });

    it('canInviteMembers é false', () => {
      expect(computeTenantValues(auth).canInviteMembers).toBe(false);
    });

    it('role é null', () => {
      expect(computeTenantValues(auth).role).toBeNull();
    });

    it('organization é null', () => {
      expect(computeTenantValues(auth).organization).toBeNull();
    });
  });

  describe('tenantMode "legacy" explícito', () => {
    const auth = { organization: ORG, membership: MEM_OWNER, tenantMode: 'legacy' };

    it('isLegacyMode é true mesmo com organização presente', () => {
      expect(computeTenantValues(auth).isLegacyMode).toBe(true);
    });
  });

  describe('auth undefined/null', () => {
    it('não lança com auth undefined', () => {
      expect(() => computeTenantValues(undefined)).not.toThrow();
    });

    it('retorna isLegacyMode true e hasOrganization false para auth vazio', () => {
      const result = computeTenantValues({});
      expect(result.hasOrganization).toBe(false);
      expect(result.isLegacyMode).toBe(true);
    });
  });
});
