import type { IUser } from '../../types/models';

type UserTenantShape = Pick<IUser, '_id' | 'email' | 'username'> & Partial<Pick<IUser, 'empresa' | 'empresaId'>>;

export function normalizeAuthIdentifier(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isEmailIdentifier(value: unknown): boolean {
  return normalizeAuthIdentifier(value).includes('@');
}

export function resolveCanonicalEmpresaId(user: UserTenantShape): string | null {
  const candidates = [(user as any).empresaId, (user as any).empresa];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }

    if (candidate && typeof candidate === 'object' && typeof (candidate as { toString(): string }).toString === 'function') {
      const value = candidate.toString().trim();
      if (value) {
        return value;
      }
    }
  }

  return null;
}
