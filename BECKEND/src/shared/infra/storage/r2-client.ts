import { S3Client } from '@aws-sdk/client-s3';

let _client: S3Client | null = null;

function normalizeEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return endpoint.replace(/\/+$/, '');
  }
}

/**
 * Retorna o S3Client configurado para o R2 privado.
 * Singleton: reutiliza a instância entre chamadas.
 * Retorna null se as credenciais não estiverem configuradas.
 */
export function getR2Client(): S3Client | null {
  if (_client) return _client;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  _client = new S3Client({
    endpoint: normalizeEndpoint(endpoint),
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
  });

  return _client;
}

/** Expõe o bucket name configurado. */
export function getR2BucketName(): string {
  return process.env.R2_BUCKET_NAME || '';
}
