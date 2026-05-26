const API_BASE_URL_PROD_FALLBACK = 'https://inmidia.squareweb.app/api/v1';

const readFrontendApiEnv = () => {
	return (
		import.meta.env.VITE_API_BASE_URL ||
		import.meta.env.VITE_API_URL ||
		import.meta.env.VITE_BACKEND_URL ||
		''
	);
};

const normalizeApiBaseUrl = (rawUrl, fallbackUrl) => {
	const base = (rawUrl || fallbackUrl || '').trim().replace(/\/+$/, '');
	if (!base) return fallbackUrl;

	// If env already points to /api or /api/v1, keep as-is.
	if (/\/api(?:\/v\d+)?$/i.test(base)) {
		return base;
	}

	return `${base}/api/v1`;
};

const API_BASE_URL_DEV = normalizeApiBaseUrl(readFrontendApiEnv(), 'http://localhost:4000/api/v1');
const API_BASE_URL_PROD = normalizeApiBaseUrl(readFrontendApiEnv(), API_BASE_URL_PROD_FALLBACK);

// Seleciona a URL correta (DEV ou PROD)
export const API_BASE_URL = import.meta.env.DEV ? API_BASE_URL_DEV : API_BASE_URL_PROD;

export const ITEMS_PER_PAGE = 10;
