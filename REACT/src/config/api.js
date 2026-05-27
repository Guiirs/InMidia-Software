// Single source of truth for API base URLs.
//
// VITE_API_BASE_URL must be the /api root — no version suffix.
//   Production:   /api                        (same-origin via OLS proxy → :4000)
//   Development:  http://localhost:4000/api   (direct backend)
//
// Versioned bases are derived here:
//   API_V1_BASE_URL  → /api/v1   used by apiClient (default for all legacy v1 services)
//   API_V4_BASE_URL  → /api/v4   for full URL generation and diagnostics
//
// Why per-request baseURL/url split instead of a second axios instance:
//   axios.combineURLs() concatenates paths that start with "/" — it doesn't treat them as
//   absolute paths unless they have a scheme (http://). So passing url="/api/v4/..." to an
//   axios instance with baseURL="/api/v1" can accidentally prepend a V4 path and duplicate
//   the version segment on the final request.
//   The fix: versioned helpers always send baseURL="/api" with url="/v4/..." (or "/v1/..."),
//   so axios produces the official same-origin gateway paths without duplicating prefixes.

const normalize = (url) => (url || '').trim().replace(/\/+$/, '');
const ABSOLUTE_URL_RE = /^[a-z][a-z\d+\-.]*:\/\//i;

const resolveApiRoot = () => {
  const raw = normalize(
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  );

  if (!raw) {
    if (import.meta.env.DEV) return 'http://localhost:4000/api';
    throw new Error('[api] VITE_API_BASE_URL is not set. Configure it in Coolify or .env.production.');
  }

  // Strip any trailing /v1, /v4 etc — keep only the /api root.
  // Handles legacy envs that still include a version: /api/v1 → /api
  return raw.replace(/\/v\d+$/i, '');
};

export const API_BASE_URL    = resolveApiRoot();               // /api  or  http://localhost:4000/api
export const API_V1_BASE_URL = `${API_BASE_URL}/v1`;          // /api/v1
export const API_V4_BASE_URL = `${API_BASE_URL}/v4`;          // /api/v4

// ─── Path helpers ─────────────────────────────────────────────────────────────
//
// Strip leading /api/vN or /vN from path — the version is already in the base URL.
const stripVersionPrefix = (path) =>
  path
    .replace(/^\/api\/v\d+/i, '')
    .replace(/^\/v\d+/i, '')
    .replace(/^api\//i, '/');

const joinPath = (base, path) => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const clean = stripVersionPrefix(normalized);
  return `${base}${clean || '/'}`;
};

const stripOrigin = (path) => {
  if (!ABSOLUTE_URL_RE.test(path)) return path;

  try {
    const url = new URL(path);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return path;
  }
};

const splitPathSuffix = (path) => {
  const match = path.match(/[?#]/);
  if (!match) return { pathname: path, suffix: '' };

  const index = match.index ?? path.length;
  return {
    pathname: path.slice(0, index),
    suffix: path.slice(index),
  };
};

const versionedPath = (version, path) => {
  const raw = stripOrigin(String(path || '').trim());
  const { pathname, suffix } = splitPathSuffix(raw || '/');
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const withoutApi = normalized.replace(/^\/api(?=\/|$)/i, '');
  const withoutVersion = withoutApi.replace(/^\/v\d+(?=\/|$)/i, '');
  const resourcePath = withoutVersion === '/' ? '' : withoutVersion;
  return `/${version}${resourcePath}${suffix}`;
};

export function buildApiUrl(path)   { return joinPath(API_BASE_URL, path); }
export function buildApiV1Url(path) { return joinPath(API_V1_BASE_URL, path); }
export function buildApiV4Url(path) { return joinPath(API_V4_BASE_URL, path); }
export function buildApiRequest(path)   { return { baseURL: API_BASE_URL, url: ensureLeadingSlash(stripOrigin(String(path || '').trim()) || '/') }; }
export function buildApiV1Request(path) { return { baseURL: API_BASE_URL, url: versionedPath('v1', path) }; }
export function buildApiV4Request(path) { return { baseURL: API_BASE_URL, url: versionedPath('v4', path) }; }

function ensureLeadingSlash(path) {
  return path.startsWith('/') ? path : `/${path}`;
}
