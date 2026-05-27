// Single source of truth for the API base URL.
//
// Production  → VITE_API_BASE_URL=/api/v1   (same-origin via OLS proxy → :4000)
// Development → VITE_API_BASE_URL=http://localhost:4000/api/v1  (set in .env.development)
//
// Why same-origin:
//   Browser never sends cross-origin requests → no CORS preflight, no duplicate headers,
//   no dependency on OLS/Cloudflare CORS configuration.

const normalize = (url) => (url || '').trim().replace(/\/+$/, '');

const resolveApiBase = () => {
  const raw = normalize(
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  );

  if (!raw) {
    // Dev with no env var → direct backend
    if (import.meta.env.DEV) return 'http://localhost:4000/api/v1';
    // Production with no env var is a misconfiguration — fail loudly at boot
    throw new Error('[api] VITE_API_BASE_URL is not set. Configure it in Coolify or .env.production.');
  }

  // Already ends with /api or /api/vN — keep as-is
  if (/\/api(?:\/v\d+)?$/i.test(raw)) return raw;

  return `${raw}/api/v1`;
};

export const API_BASE_URL = resolveApiBase();
