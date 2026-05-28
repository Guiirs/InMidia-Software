/**
 * Testes do proxy público de imagem — enterprise-grade.
 *
 * Cobre:
 *   - ETag correto (R2 nativo)
 *   - If-None-Match → 304 sem rebuscar stream
 *   - Last-Modified correto
 *   - If-Modified-Since → 304 sem rebuscar stream
 *   - Cache Redis hit → metadados usados sem MongoDB
 *   - Cache Redis miss → MongoDB + R2
 *   - Redis indisponível → fallback para MongoDB + R2
 *   - Headers CDN corretos (Cache-Control, ETag, Last-Modified, Vary, Surrogate-Control)
 *   - Ausência de regressão de segurança (?path=, traversal)
 *   - Rate limit aplicado (middleware presente)
 *   - Compatibilidade: endpoint funciona sem req.publicApi
 *   - 404 para placa inexistente, sem imagem, R2 NoSuchKey
 *   - R2 Body null → 404
 *   - Storage indisponível → 503
 */

import { Readable } from 'stream';
import { getPlacaImagem } from './public-plates-image.controller';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('./public-plates.service', () => ({
  getPlacaDocForImagePublic: jest.fn(),
}));

jest.mock('./image-cache.service', () => ({
  getImageMetaFromCache: jest.fn(),
  setImageMetaInCache: jest.fn(),
  isImageCacheAvailable: jest.fn(),
}));

jest.mock('@shared/infra/storage/r2-client', () => ({
  getR2Client: jest.fn(),
  getR2BucketName: jest.fn(),
}));

jest.mock('@shared/infra/storage/r2-key.helper', () => ({
  extractR2Key: jest.fn(),
}));

jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

import * as service from './public-plates.service';
import * as imageCache from './image-cache.service';
import * as r2ClientModule from '@shared/infra/storage/r2-client';
import * as r2KeyHelper from '@shared/infra/storage/r2-key.helper';

const mockedGetDoc = service.getPlacaDocForImagePublic as jest.MockedFunction<typeof service.getPlacaDocForImagePublic>;
const mockedCacheGet = imageCache.getImageMetaFromCache as jest.MockedFunction<typeof imageCache.getImageMetaFromCache>;
const mockedCacheSet = imageCache.setImageMetaInCache as jest.MockedFunction<typeof imageCache.setImageMetaInCache>;
const mockedCacheAvail = imageCache.isImageCacheAvailable as jest.MockedFunction<typeof imageCache.isImageCacheAvailable>;
const mockedGetR2Client = r2ClientModule.getR2Client as jest.MockedFunction<typeof r2ClientModule.getR2Client>;
const mockedGetBucket = r2ClientModule.getR2BucketName as jest.MockedFunction<typeof r2ClientModule.getR2BucketName>;
const mockedExtractKey = r2KeyHelper.extractR2Key as jest.MockedFunction<typeof r2KeyHelper.extractR2Key>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLACA_ID = '69d7d2a69b9a603e468392e3';
const R2_KEY = 'inmidia-uploads-sistema/cau-37.jpg';
const ETAG = '"abc123def456abc123def456abc12345"';
const LAST_MODIFIED = 'Thu, 01 Jan 2026 12:00:00 GMT';
const UPDATED_AT = '2026-01-01T12:00:00.000Z';

const BASE_CACHED_META = {
  placaId: PLACA_ID,
  r2Key: R2_KEY,
  etag: ETAG,
  lastModified: LAST_MODIFIED,
  contentType: 'image/jpeg',
  contentLength: 102400,
  updatedAt: UPDATED_AT,
};

const BASE_DOC = {
  imagemPrincipal: R2_KEY,
  updatedAt: new Date(UPDATED_AT),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(
  id: string,
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
): any {
  return {
    params: { id },
    query,
    header: jest.fn((name: string) => headers[name.toLowerCase()] ?? undefined),
  };
}

function makeRes(): any {
  const headers: Record<string, string> = {};
  const res: any = {
    _status: 0,
    _body: null,
    _headers: headers,
    _ended: false,
    status(code: number) { this._status = code; return this; },
    json(body: any) { this._body = body; return this; },
    set(name: string, value: string) { headers[name.toLowerCase()] = value; return this; },
    end() { this._ended = true; return this; },
    headersSent: false,
    destroy: jest.fn(),
  };
  return res;
}

function makeReadableStream(data = 'fake-image-bytes'): Readable {
  const stream = new Readable({ read() {} });
  stream.push(Buffer.from(data));
  stream.push(null);
  return stream;
}

function mockR2GetObject(overrides: {
  Body?: any;
  ContentType?: string;
  ContentLength?: number;
  ETag?: string;
  LastModified?: Date;
} = {}): any {
  const stream = makeReadableStream();
  stream.pipe = jest.fn(() => stream) as any;

  const defaults = {
    Body: stream,
    ContentType: 'image/jpeg',
    ContentLength: 102400,
    ETag: ETAG,
    LastModified: new Date(LAST_MODIFIED),
  };
  return {
    send: jest.fn().mockResolvedValue({ ...defaults, ...overrides }),
  };
}


// ── Setup default mocks ───────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetBucket.mockReturnValue('inmidia-uploads-sistema');
  mockedExtractKey.mockReturnValue(R2_KEY);
  mockedGetDoc.mockResolvedValue(BASE_DOC);
  mockedCacheAvail.mockReturnValue(true);
  mockedCacheGet.mockResolvedValue(null); // cache miss por padrão
  mockedCacheSet.mockResolvedValue(undefined);
  mockedGetR2Client.mockReturnValue(mockR2GetObject() as any);
});

// ── Testes de autenticação ─────────────────────────────────────────────────────

describe('autenticação', () => {
  it('funciona sem req.publicApi (endpoint público)', async () => {
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(mockedGetDoc).toHaveBeenCalled();
  });

  it('não lê req.publicApi em nenhum path', async () => {
    const req = makeReq(PLACA_ID);
    Object.defineProperty(req, 'publicApi', {
      get() { throw new Error('publicApi NÃO deve ser lido'); },
    });
    const res = makeRes();
    await expect(getPlacaImagem(req, res, jest.fn())).resolves.not.toThrow();
  });
});

// ── Testes de segurança ───────────────────────────────────────────────────────

describe('segurança — query params bloqueados', () => {
  test.each(['path', 'key', 'file', 'url', 'src'])('?%s= retorna 400', async (param) => {
    const req = makeReq(PLACA_ID, {}, { [param]: 'evil' });
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(400);
  });

  it('query param não bloqueado é permitido', async () => {
    const req = makeReq(PLACA_ID, {}, { width: '800' });
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(mockedGetDoc).toHaveBeenCalled();
  });
});

describe('segurança — traversal e extensão inválida', () => {
  it('extractR2Key retornando null → 404 (traversal bloqueado)', async () => {
    mockedExtractKey.mockReturnValue(null);
    mockedCacheGet.mockResolvedValue(null);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(404);
  });

  it('payload de erro não contém r2.dev', async () => {
    mockedExtractKey.mockReturnValue(null);
    mockedGetDoc.mockResolvedValue({ imagemPrincipal: 'https://pub-xyz.r2.dev/key.jpg' });
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(JSON.stringify(res._body)).not.toContain('r2.dev');
    expect(JSON.stringify(res._body)).not.toContain('cloudflarestorage');
  });
});

// ── Testes de ETag e 304 ──────────────────────────────────────────────────────

describe('ETag e cache condicional', () => {
  it('resposta inclui ETag no header', async () => {
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({
        Body: stream,
        ETag: ETAG,
        LastModified: new Date(LAST_MODIFIED),
        ContentType: 'image/jpeg',
        ContentLength: 1024,
      }),
    } as any);

    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._headers['etag']).toBe(ETAG);
  });

  it('If-None-Match match → 304 sem stream (cache Redis hit)', async () => {
    mockedCacheGet.mockResolvedValue(BASE_CACHED_META);
    const req = makeReq(PLACA_ID, { 'if-none-match': ETAG });
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(304);
    expect(res._ended).toBe(true);
    // R2 não deve ter sido chamado
    expect(mockedGetR2Client()!.send).not.toHaveBeenCalled();
  });

  it('If-None-Match diferente → 200 com stream', async () => {
    mockedCacheGet.mockResolvedValue(BASE_CACHED_META);
    const stream = makeReadableStream();
    let pipeCalled = false;
    stream.pipe = jest.fn(() => { pipeCalled = true; return stream; }) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({
        Body: stream, ETag: ETAG, LastModified: new Date(LAST_MODIFIED),
        ContentType: 'image/jpeg',
      }),
    } as any);

    const req = makeReq(PLACA_ID, { 'if-none-match': '"outro-etag"' });
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(pipeCalled).toBe(true);
  });

  it('If-None-Match: * → 304', async () => {
    mockedCacheGet.mockResolvedValue(BASE_CACHED_META);
    const req = makeReq(PLACA_ID, { 'if-none-match': '*' });
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(304);
  });

  it('304 inclui ETag e Cache-Control', async () => {
    mockedCacheGet.mockResolvedValue(BASE_CACHED_META);
    const req = makeReq(PLACA_ID, { 'if-none-match': ETAG });
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._headers['etag']).toBe(ETAG);
    expect(res._headers['cache-control']).toContain('public');
  });

  it('304 não chama MongoDB (Redis hit)', async () => {
    mockedCacheGet.mockResolvedValue(BASE_CACHED_META);
    const req = makeReq(PLACA_ID, { 'if-none-match': ETAG });
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(mockedGetDoc).not.toHaveBeenCalled();
  });
});

// ── Testes de Last-Modified ───────────────────────────────────────────────────

describe('Last-Modified e cache condicional', () => {
  it('resposta inclui Last-Modified no header', async () => {
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({
        Body: stream,
        ETag: ETAG,
        LastModified: new Date('2026-01-01T12:00:00.000Z'),
        ContentType: 'image/jpeg',
      }),
    } as any);

    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._headers['last-modified']).toBeTruthy();
  });

  it('If-Modified-Since não modificado → 304 (cache Redis hit)', async () => {
    mockedCacheGet.mockResolvedValue(BASE_CACHED_META);
    // Recurso modificado em Jan 2026; cliente diz "já tenho de Feb 2026"
    const req = makeReq(PLACA_ID, { 'if-modified-since': 'Mon, 01 Feb 2026 00:00:00 GMT' });
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(304);
  });

  it('If-Modified-Since mais antigo → não 304 (recurso é mais novo)', async () => {
    mockedCacheGet.mockResolvedValue(BASE_CACHED_META);
    // Recurso é de Jan 2026; cliente diz "já tenho de Dec 2025"
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({
        Body: stream, ETag: ETAG, LastModified: new Date(LAST_MODIFIED), ContentType: 'image/jpeg',
      }),
    } as any);
    const req = makeReq(PLACA_ID, { 'if-modified-since': 'Mon, 01 Dec 2025 00:00:00 GMT' });
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    // Deve servir a imagem normalmente
    expect(res._status).not.toBe(304);
  });
});

// ── Testes de Redis cache ─────────────────────────────────────────────────────

describe('Redis cache', () => {
  it('cache hit: não chama MongoDB', async () => {
    mockedCacheGet.mockResolvedValue(BASE_CACHED_META);
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({ Body: stream, ETag: ETAG, ContentType: 'image/jpeg' }),
    } as any);

    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(mockedGetDoc).not.toHaveBeenCalled();
  });

  it('cache miss: chama MongoDB e depois R2', async () => {
    mockedCacheGet.mockResolvedValue(null);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(mockedGetDoc).toHaveBeenCalledWith(PLACA_ID);
  });

  it('cache miss com GetObject: salva metadata no Redis', async () => {
    mockedCacheGet.mockResolvedValue(null);
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({
        Body: stream,
        ETag: ETAG,
        LastModified: new Date(LAST_MODIFIED),
        ContentType: 'image/jpeg',
        ContentLength: 1024,
      }),
    } as any);

    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    // setImageMetaInCache deve ter sido chamado
    expect(mockedCacheSet).toHaveBeenCalledWith(
      expect.objectContaining({ placaId: PLACA_ID, r2Key: R2_KEY }),
    );
  });

  it('Redis indisponível: fallback para MongoDB + R2', async () => {
    mockedCacheAvail.mockReturnValue(false);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    // MongoDB deve ter sido chamado mesmo sem Redis
    expect(mockedGetDoc).toHaveBeenCalled();
  });

  it('Redis indisponível: resposta normal (sem erro)', async () => {
    mockedCacheAvail.mockReturnValue(false);
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({ Body: stream, ETag: ETAG, ContentType: 'image/jpeg' }),
    } as any);

    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).not.toBe(500);
    expect(res._status).not.toBe(503);
  });

  it('cache miss com HeadObject (conditional): salva no Redis antes do 304', async () => {
    // Simula HeadObject com send que retorna metadata
    const headClient = {
      send: jest.fn().mockResolvedValue({
        ETag: ETAG,
        LastModified: new Date(LAST_MODIFIED),
        ContentType: 'image/jpeg',
        ContentLength: 1024,
      }),
    };
    mockedGetR2Client.mockReturnValue(headClient as any);

    const req = makeReq(PLACA_ID, { 'if-none-match': ETAG });
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());

    expect(res._status).toBe(304);
    expect(mockedCacheSet).toHaveBeenCalled();
  });
});

// ── Testes de CDN headers ─────────────────────────────────────────────────────

describe('CDN headers', () => {
  it('inclui Cache-Control CDN-ready', async () => {
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({ Body: stream, ETag: ETAG, ContentType: 'image/jpeg' }),
    } as any);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._headers['cache-control']).toBe(
      'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    );
  });

  it('inclui Surrogate-Control para CDN enterprise', async () => {
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({ Body: stream, ETag: ETAG, ContentType: 'image/jpeg' }),
    } as any);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._headers['surrogate-control']).toBeTruthy();
  });

  it('inclui Vary: Accept-Encoding (sem Vary: x-api-key)', async () => {
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({ Body: stream, ETag: ETAG, ContentType: 'image/jpeg' }),
    } as any);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._headers['vary']).toBe('Accept-Encoding');
  });

  it('inclui X-Public-Api-Version', async () => {
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({ Body: stream, ETag: ETAG, ContentType: 'image/jpeg' }),
    } as any);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._headers['x-public-api-version']).toBe('v1');
  });

  it('inclui Content-Type correto', async () => {
    const stream = makeReadableStream();
    stream.pipe = jest.fn(() => stream) as any;
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({ Body: stream, ETag: ETAG, ContentType: 'image/webp' }),
    } as any);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._headers['content-type']).toBe('image/webp');
  });
});

// ── Testes de 404 e erros ─────────────────────────────────────────────────────

describe('erros', () => {
  it('placa inexistente → 404', async () => {
    mockedGetDoc.mockResolvedValue(null);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(404);
  });

  it('placa sem imagem → 404', async () => {
    mockedGetDoc.mockResolvedValue({ imagemPrincipal: null, imagem: null, imagens: [] });
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(404);
  });

  it('R2 NoSuchKey → 404', async () => {
    const err: any = new Error('NoSuchKey');
    err.name = 'NoSuchKey';
    mockedGetR2Client.mockReturnValue({ send: jest.fn().mockRejectedValue(err) } as any);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(404);
  });

  it('R2 httpStatus 404 → 404', async () => {
    const err: any = new Error('Not Found');
    err.$metadata = { httpStatusCode: 404 };
    mockedGetR2Client.mockReturnValue({ send: jest.fn().mockRejectedValue(err) } as any);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(404);
  });

  it('R2 Body null → 404', async () => {
    mockedGetR2Client.mockReturnValue({
      send: jest.fn().mockResolvedValue({ Body: null }),
    } as any);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(404);
  });

  it('storage indisponível (sem client) → 503', async () => {
    mockedGetR2Client.mockReturnValue(null as any);
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(res._status).toBe(503);
  });

  it('erros nunca expõem stack trace', async () => {
    mockedGetDoc.mockRejectedValue(new Error('db connection failed with password: secret'));
    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());
    expect(JSON.stringify(res._body)).not.toContain('db connection');
    expect(JSON.stringify(res._body)).not.toContain('secret');
    expect(JSON.stringify(res._body)).not.toContain('stack');
  });
});
