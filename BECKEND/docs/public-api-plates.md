# API Pública de Placas — InMidia

Documentação dos endpoints públicos de placas para integração com WordPress/JetEngine e outros parceiros.

---

## Autenticação

Todos os endpoints de dados requerem API key de parceiro:

```
x-api-key: <sua-api-key>
```

Endpoints de imagem são públicos (sem autenticação).

---

## Rate Limiting

| Camada | Limite | Janela | Código de Erro |
|---|---|---|---|
| Dados paginados (`/placas`, `/placas/:slug`) | 100 req | 15 min | `PUBLIC_API_RATE_LIMITED` |
| Export bulk (`/placas/export`) | 300 req | 15 min | `PUBLIC_EXPORT_RATE_LIMITED` |
| Mídia / Imagens | 5.000 req | 15 min | `PUBLIC_MEDIA_RATE_LIMITED` |

Buckets são isolados por API key (prefixo) ou IP como fallback.

---

## Endpoints

### 1. Listagem Paginada

```
GET /api/v1/public/placas
GET /api/public/placas
```

Retorna placas paginadas. Use para listagens interativas com filtros.

**Query params:**

| Param | Tipo | Descrição |
|---|---|---|
| `page` | number | Página (default: 1) |
| `limit` | number | Itens por página (default: 24, max: 100) |
| `cidade` | string | Filtrar por cidade |
| `regiao` | string | Filtrar por região |
| `categoria` | string | Filtrar por categoria/tipo |
| `disponibilidade` | string | `disponivel`, `reservado`, `ocupado`, `indisponivel` |

**Resposta:**

```json
{
  "success": true,
  "data": [/* array de placas */],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 37,
    "pages": 2
  },
  "meta": {
    "requestId": "...",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**Cache:** `private, max-age=60` (por API key via `Vary: x-api-key`).

---

### 2. Export Bulk — RECOMENDADO PARA WORDPRESS/JETENGINE

```
GET /api/v1/public/placas/export
GET /api/public/placas/export
```

Retorna **todas** as placas sem limit artificial. Use este endpoint no WordPress/JetEngine para carregar o catálogo completo de uma vez.

**Por que usar `/export` em vez de `/placas`?**

- `/placas` retorna 24 por página — requer múltiplas chamadas para 37+ placas
- `/export` retorna tudo em uma única requisição
- Rate limit do export (300/15min) é mais generoso que dados paginados (100/15min)
- Cache `public, max-age=60, stale-while-revalidate=300` permite CDN/proxy local

**Query params (mesmos filtros do endpoint paginado):**

| Param | Tipo | Descrição |
|---|---|---|
| `cidade` | string | Filtrar por cidade |
| `regiao` | string | Filtrar por região |
| `categoria` | string | Filtrar por categoria/tipo |
| `disponibilidade` | string | `disponivel`, `reservado`, `ocupado`, `indisponivel` |

**Resposta:**

```json
{
  "success": true,
  "data": [/* todas as placas */],
  "meta": {
    "total": 37,
    "exportedAt": "2024-01-01T00:00:00.000Z",
    "requestId": "...",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**Limite máximo:** Controlado por `PUBLIC_EXPORT_MAX_ITEMS` no `.env` (default: 1000).

**Cache:** `public, max-age=60, stale-while-revalidate=300` com `Vary: x-api-key`.

---

### 3. Placa por Slug

```
GET /api/v1/public/placas/:id
GET /api/public/placas/:slug
```

**Resposta:**

```json
{
  "success": true,
  "data": { /* placa */ },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

---

### 4. Imagem da Placa (proxy seguro)

```
GET /api/v1/public/media/plates/:id/main
GET /api/v1/public/placas/:id/imagem      (legado)
GET /api/public/placas/:id/imagem         (legado)
```

Endpoint público sem autenticação. O browser carrega diretamente com `<img src="...">`.

- Nunca expõe URL direta do R2/Cloudflare Storage
- Suporta conditional requests (ETag / Last-Modified → 304)
- Cache `public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400`
- Rate limit: 5.000 req/15min (suporta páginas com 37+ imagens simultâneas)

---

## Contrato de Placa

Cada objeto de placa no array `data` tem a seguinte estrutura:

```json
{
  "id": "string — MongoDB ObjectId",
  "slug": "string — kebab-case do código",
  "codigo": "string — número/código da placa",
  "nome": "string — nome público",
  "localizacao": "string | null",
  "status": "disponivel | reservado | ocupado | indisponivel | desconhecido",
  "imagemUrl": "string | null — URL do proxy de imagem",
  "hasImage": "boolean",
  "latitude": "number | null",
  "longitude": "number | null",
  "endereco": "string | null",
  "regiao": "string | null — nome da região",
  "cidade": "string | null",
  "categoria": "string | null — tipo de placa",
  "medidas": "string | null",
  "disponibilidade": "disponivel | reservado | ocupado | indisponivel | desconhecido",
  "updatedAt": "string | null — ISO 8601",

  "_aliases_jetengine_": "campos abaixo são aliases para retrocompatibilidade",
  "imagem": "string | null — alias de imagemUrl",
  "imagemMeta": {
    "url": "string",
    "mimeType": "string | null",
    "cacheable": true,
    "updatedAt": "string | null"
  },
  "jetImageUrl": "string | null — alias para JetEngine",
  "jet_image_url": "string | null — alias para JetEngine (snake_case)",
  "jetImage": {
    "id": 0,
    "url": "string",
    "alt": "string",
    "title": "string"
  },
  "image": {
    "url": "string",
    "alt": "string",
    "title": "string"
  }
}
```

**Campos que NUNCA aparecem na resposta:**
- `storageKey`, `r2Key`, `imagemKey` — chaves internas do storage
- `imagemPrincipal` — campo raw do banco
- `empresaId` — isolamento de tenant
- `statusComercial`, `statusOperacional` — status internos

---

## Exemplo de Uso no WordPress/JetEngine

### Fetch de todas as placas (JetEngine Custom Query)

```javascript
// Configuração no JetEngine Query Builder
// Endpoint: GET /api/v1/public/placas/export
// Header: x-api-key: <sua-key>

// Exemplo com fetch nativo
const response = await fetch('https://api.seudominio.com/api/v1/public/placas/export', {
  headers: { 'x-api-key': 'sua_api_key_aqui' }
});
const { data } = await response.json();
// data = array com TODAS as placas
```

### Exibir imagem no WordPress

```html
<!-- Use imagemUrl diretamente como src — o proxy retorna a imagem correta -->
<img src="<?= esc_url($placa['imagemUrl']) ?>" alt="<?= esc_attr($placa['nome']) ?>">

<!-- Ou via JetEngine dynamic field: imagemUrl / jetImageUrl / jet_image_url -->
```

### Paginação manual no WordPress (caso prefira)

```javascript
// Página 1: 24 placas
GET /api/v1/public/placas?page=1&limit=24

// Página 2: restante
GET /api/v1/public/placas?page=2&limit=24

// Recomendado: use /export para evitar múltiplas chamadas
GET /api/v1/public/placas/export
```

---

## Configuração de Ambiente (`.env`)

```env
# URL base para construção das URLs de imagem (obrigatório em produção)
PUBLIC_API_BASE_URL=https://api.seudominio.com

# Número máximo de placas retornadas no endpoint /export (default: 1000)
PUBLIC_EXPORT_MAX_ITEMS=1000
```
