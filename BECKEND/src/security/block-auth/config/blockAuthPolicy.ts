export interface BlockAuthPolicyConfig {
  trustCloudflare: boolean;
  blockDirectBackendAccess: boolean;
  trustedProxies: string[];
  exemptPaths: readonly string[];
  publicApiPaths: readonly string[];
}

export const blockAuthPolicy: BlockAuthPolicyConfig = {
  trustCloudflare: process.env.TRUST_CLOUDFLARE === 'true',
  blockDirectBackendAccess: process.env.BLOCK_DIRECT_BACKEND_ACCESS === 'true',
  trustedProxies: (process.env.TRUSTED_PROXIES || '').split(',').filter(Boolean),
  exemptPaths: ['/health', '/api/health', '/api/v1/health', '/api/v1/status'],
  publicApiPaths: ['/api/public/', '/api/v1/public/', '/public/v1/', '/public/'],
};

export function isExemptPath(path: string): boolean {
  return (blockAuthPolicy.exemptPaths as string[]).includes(path);
}

export function isPublicApiPath(path: string): boolean {
  return (blockAuthPolicy.publicApiPaths as string[]).some((prefix) => path.startsWith(prefix));
}
