export const PUBLIC_CORS_PREFIXES = ['/public/', '/api/v1/public/', '/api/public/'] as const;

export function isPublicCorsPath(path: string): boolean {
  return PUBLIC_CORS_PREFIXES.some((prefix) => path.startsWith(prefix));
}
