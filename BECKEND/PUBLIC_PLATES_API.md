# Public Plates API — Documentação

API pública para consumo de placas (pontos de mídia OOH) via WordPress ou qualquer cliente externo.

---

## Base URL

```
https://api.seudominio.com/api/public
```

> Sem `/v1` na URL — endpoints estáveis de catálogo não precisam de versionamento visível.

---

## Autenticação

Todas as rotas exigem o header `x-api-key`:

```http
x-api-key: PREFIX_SECRET
```

Formato da chave: `prefix_secret` separado pelo último underscore.  
Exemplo: `cefor_a1b2c3d4e5f6...`

**Suporte futuro (preparado, não ativado por padrão):**
```http
Authorization: Bearer PREFIX_SECRET
```

### Como obter a API Key

A chave é gerada automaticamente ao criar a empresa no sistema InMidia.  
A chave nunca é armazenada em plain text — apenas o hash bcrypt e o prefix ficam no banco.

---

## Endpoints

### `GET /api/public/placas`

Lista placas públicas com filtros e paginação.

**Headers obrigatórios:**
```http
x-api-key: PREFIX_SECRET
```

**Query params:**

| Param | Tipo | Exemplo | Descrição |
|-------|------|---------|-----------|
| `cidade` | string | `Fortaleza` | Filtra por cidade da região |
| `regiao` | string | `Aldeota` | Filtra por nome da região |
| `categoria` | string | `Outdoor` | Filtra pelo tipo/categoria da placa |
| `disponibilidade` | string | `disponivel` | `disponivel`, `reservado`, `ocupado`, `indisponivel` |
| `page` | number | `1` | Página (default: 1) |
| `limit` | number | `24` | Itens por página (default: 24, max: 100) |

**Exemplo de request:**
```http
GET /api/public/placas?cidade=Fortaleza&disponibilidade=disponivel&page=1&limit=24
x-api-key: cefor_a1b2c3d4e5f6...
```

**Exemplo de resposta:**
```json
{
  "success": true,
  "data": [
    {
      "slug": "ce-0042",
      "codigo": "CE-0042",
      "endereco": "Av. Beira Mar, 1200",
      "regiao": "Aldeota",
      "cidade": "Fortaleza",
      "categoria": "Outdoor",
      "medidas": "9x3m",
      "imagem": "https://cdn.seudominio.com/placas/ce-0042.jpg",
      "disponibilidade": "disponivel",
      "updatedAt": "2026-05-25T14:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 87,
    "pages": 4
  },
  "meta": {
    "requestId": "pub_1abc2_xyz",
    "timestamp": "2026-05-26T10:00:00.000Z"
  }
}
```

---

### `GET /api/public/placas/:slug`

Busca uma placa específica pelo slug.

O slug é derivado do código da placa (`CE-0042` → `ce-0042`).  
Regra: lowercase + caracteres não alfanuméricos substituídos por `-`.

**Exemplo de request:**
```http
GET /api/public/placas/ce-0042
x-api-key: cefor_a1b2c3d4e5f6...
```

**Resposta (encontrada):**
```json
{
  "success": true,
  "data": {
    "slug": "ce-0042",
    "codigo": "CE-0042",
    "endereco": "Av. Beira Mar, 1200",
    "regiao": "Aldeota",
    "cidade": "Fortaleza",
    "categoria": "Outdoor",
    "medidas": "9x3m",
    "imagem": "https://cdn.seudominio.com/placas/ce-0042.jpg",
    "disponibilidade": "disponivel",
    "updatedAt": "2026-05-25T14:00:00.000Z"
  },
  "meta": {
    "requestId": "pub_1abc2_xyz",
    "timestamp": "2026-05-26T10:00:00.000Z"
  }
}
```

**Resposta (não encontrada):**
```json
{
  "success": false,
  "error": { "code": "PUBLIC_API_NOT_FOUND", "message": "Placa não encontrada." },
  "meta": { ... }
}
```

---

### `GET /api/public/regioes`

Lista todas as regiões ativas da empresa.

**Exemplo de request:**
```http
GET /api/public/regioes
x-api-key: cefor_a1b2c3d4e5f6...
```

**Exemplo de resposta:**
```json
{
  "success": true,
  "data": [
    { "slug": "aldeota", "nome": "Aldeota", "cidade": "Fortaleza", "estado": "CE" },
    { "slug": "meireles", "nome": "Meireles", "cidade": "Fortaleza", "estado": "CE" }
  ],
  "meta": {
    "requestId": "pub_1abc2_xyz",
    "timestamp": "2026-05-26T10:00:00.000Z",
    "count": 2
  }
}
```

---

### `GET /api/public/disponibilidade`

Retorna um resumo de disponibilidade agregado de todas as placas da empresa.

**Exemplo de request:**
```http
GET /api/public/disponibilidade
x-api-key: cefor_a1b2c3d4e5f6...
```

**Exemplo de resposta:**
```json
{
  "success": true,
  "data": {
    "total": 87,
    "disponivel": 42,
    "reservado": 15,
    "ocupado": 25,
    "indisponivel": 5
  },
  "meta": { ... }
}
```

---

## Payload Público — Campos Expostos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `slug` | string | Identificador público estável (derivado do código) |
| `codigo` | string | Código da placa (`numero_placa`) |
| `endereco` | string\|null | Endereço público da placa |
| `regiao` | string\|null | Nome da região |
| `cidade` | string\|null | Cidade da região |
| `categoria` | string\|null | Tipo/categoria da placa (ex.: "Outdoor") |
| `medidas` | string\|null | Tamanho da placa (ex.: "9x3m") |
| `imagem` | string\|null | URL da imagem principal |
| `disponibilidade` | string | `disponivel`, `reservado`, `ocupado`, `indisponivel`, `desconhecido` |
| `updatedAt` | string\|null | ISO 8601 da última atualização |

---

## Dados NÃO Expostos

Os seguintes dados **nunca** aparecem no payload público:

- `_id` / `empresaId` / `regiaoId` (IDs internos MongoDB)
- `tenantId` / `owner`
- `latitude` / `longitude` (coordenadas exatas)
- `statusOperacional` (estado interno ACTIVE/MAINTENANCE/ARCHIVED)
- `disponivel` (booleano interno)
- `valor_mensal` (dado comercial)
- `createdBy` / `updatedBy` (auditoria interna)
- `archivedAt` / `archivedBy`
- `cliente` / `contrato` / `aluguel`
- `healthScore` / `alertas`
- `SLA` / `receita`
- Tokens de sessão / refresh tokens
- Dados administrativos de usuários

---

## Mapeamento de Disponibilidade

| Valor na URL | statusComercial no banco |
|-------------|--------------------------|
| `disponivel` | `AVAILABLE` |
| `reservado` | `RESERVED` |
| `ocupado` | `OCCUPIED` |
| `indisponivel` | `UNAVAILABLE` |

---

## Headers de Cache

Todas as respostas incluem:

```http
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

- `max-age=60`: Cache por 60 segundos
- `stale-while-revalidate=300`: Serve stale por até 5 minutos enquanto revalida em background

---

## CORS

O CORS é controlado pela variável `CORS_ORIGIN` no `.env`:

```env
CORS_ORIGIN=https://seuwordpress.com,https://www.seuwordpress.com
```

- Não é permitido `*` com credentials habilitado
- Em produção, a whitelist deve ser explícita
- Requests sem `Origin` (curl, probes) são permitidos

---

## Erros

| Código | HTTP | Descrição |
|--------|------|-----------|
| `PUBLIC_API_KEY_MISSING` | 401 | Header `x-api-key` ausente |
| `PUBLIC_API_KEY_INVALID` | 403 | Chave inválida ou formato incorreto |
| `PUBLIC_API_KEY_INACTIVE` | 403 | Empresa inativa |
| `PUBLIC_API_NOT_FOUND` | 404 | Placa ou recurso não encontrado |
| `PUBLIC_API_INTERNAL_ERROR` | 500 | Erro interno |

**Formato de erro:**
```json
{
  "success": false,
  "error": {
    "code": "PUBLIC_API_KEY_MISSING",
    "message": "API key ausente."
  },
  "meta": {
    "requestId": "pub_1abc2_xyz",
    "version": "v1",
    "timestamp": "2026-05-26T10:00:00.000Z"
  }
}
```

---

## Exemplos curl

### Listar placas disponíveis em Fortaleza
```bash
curl -H "x-api-key: cefor_a1b2c3d4e5f6..." \
  "http://localhost:4000/api/public/placas?cidade=Fortaleza&disponibilidade=disponivel"
```

### Buscar placa por slug
```bash
curl -H "x-api-key: cefor_a1b2c3d4e5f6..." \
  "http://localhost:4000/api/public/placas/ce-0042"
```

### Listar regiões
```bash
curl -H "x-api-key: cefor_a1b2c3d4e5f6..." \
  "http://localhost:4000/api/public/regioes"
```

### Resumo de disponibilidade
```bash
curl -H "x-api-key: cefor_a1b2c3d4e5f6..." \
  "http://localhost:4000/api/public/disponibilidade"
```

---

## Configuração WordPress

No WordPress, use `wp_remote_get` ou `fetch` com o header de autenticação:

```php
$response = wp_remote_get(
    'https://api.seudominio.com/api/public/placas?disponibilidade=disponivel&limit=24',
    [
        'headers' => [
            'x-api-key' => defined('INMIDIA_API_KEY') ? INMIDIA_API_KEY : '',
        ],
        'timeout' => 10,
    ]
);

if ( is_wp_error($response) ) {
    // handle error
    return;
}

$body = json_decode( wp_remote_retrieve_body($response), true );
$placas = $body['data'] ?? [];
```

Adicione no `wp-config.php`:
```php
define('INMIDIA_API_KEY', 'cefor_a1b2c3d4e5f6...');
```

---

## Exemplos Postman

### Collection Variables
```
base_url: http://localhost:4000
api_key: cefor_a1b2c3d4e5f6...
```

### Request: Lista de placas
- Method: GET
- URL: `{{base_url}}/api/public/placas`
- Headers: `x-api-key: {{api_key}}`
- Params: `disponibilidade=disponivel`, `limit=24`

### Request: Placa por slug
- Method: GET
- URL: `{{base_url}}/api/public/placas/ce-0042`
- Headers: `x-api-key: {{api_key}}`

### Request: Regiões
- Method: GET
- URL: `{{base_url}}/api/public/regioes`
- Headers: `x-api-key: {{api_key}}`

### Request: Disponibilidade
- Method: GET
- URL: `{{base_url}}/api/public/disponibilidade`
- Headers: `x-api-key: {{api_key}}`

---

## Próximos Passos

- [ ] Adicionar campo `slug` persistente no schema da Placa para lookups O(1) garantidos
- [ ] Implementar ETag / Last-Modified para cache condicional
- [ ] Rate limiting específico por API Key (atualmente herda o global de 2000 req/min por IP)
- [ ] Endpoint `/api/public/placas/:slug/midia` para galeria pública de imagens
- [ ] Webhook para notificar WordPress quando disponibilidade muda
- [ ] Scope granular `placas:read` separado dos scopes internos de inventory
- [ ] Dashboard de uso por API Key (lastUsedAt já é registrado em `api_key_last_used_at`)
- [ ] Coordenadas aproximadas opcionais (`?include_geo=1`) quando decisão for tomada

---

## Arquivos Criados/Alterados

| Arquivo | Operação |
|---------|----------|
| `src/modules/public-api/managers/public-api-key.manager.ts` | Criado |
| `src/modules/public-plates/public-plates.presenter.ts` | Criado |
| `src/modules/public-plates/public-plates.service.ts` | Criado |
| `src/modules/public-plates/public-plates.controller.ts` | Criado |
| `src/modules/public-plates/public-plates.routes.ts` | Criado |
| `src/modules/public-plates/index.ts` | Criado |
| `src/database/schemas/empresa.schema.ts` | Adicionado `api_key_last_used_at` |
| `src/gateway/module-registry.ts` | Registrado módulo `public-plates` em `/api/public` |
