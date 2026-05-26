# Deploy Backend — Coolify

## Visão geral

| Item | Valor |
|------|-------|
| Runtime | Node.js 20 (Docker) |
| Framework | Express 5 + TypeScript |
| Porta interna | `4000` (ou `PORT` env) |
| Healthcheck | `GET /api/health` → `200 OK` |
| Build | `npm run build` (TypeScript → `dist/`) |
| Start | `node -r module-alias/register dist/shared/infra/http/server.js` |

---

## 1. Criar app no Coolify

1. Painel Coolify → **New Resource → Application**
2. Selecionar o repositório Git do projeto
3. Em **Build Pack**: selecionar **Dockerfile**
4. **Dockerfile path**: `BECKEND/Dockerfile`
5. **Docker build context**: `BECKEND` (raiz do backend)
6. **Exposed port**: `4000`

---

## 2. Variáveis de ambiente obrigatórias

Estas variáveis causam `process.exit(1)` se ausentes em produção.

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NODE_ENV` | Modo de execução | `production` |
| `JWT_SECRET` | Chave JWT — mínimo 64 chars | `<gerado com crypto.randomBytes(64)>` |
| `MONGODB_URI` | URI do MongoDB | `mongodb+srv://user:pass@cluster/db` |
| `CORS_ORIGIN` | Origem do frontend (sem barra final) | `https://meuapp.com` |
| `METRICS_USER` | Usuário para /metrics | `metrics_user` |
| `METRICS_PASSWORD` | Senha para /metrics | `<senha forte>` |

### Variáveis importantes (com defaults aceitáveis)

| Variável | Default | Descrição |
|----------|---------|-----------|
| `PORT` | `4000` | Porta do servidor |
| `REDIS_URL` | `redis://localhost:6379` | URL do Redis (BullMQ + blacklist JWT) |
| `ACCESS_TOKEN_EXPIRES_IN` | `15m` | Duração do access token |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` | Duração do refresh token |
| `TZ` | sistema | Fuso horário (`Europe/Lisbon`) |

### Variáveis opcionais (features)

| Variável | Descrição |
|----------|-----------|
| `R2_ENDPOINT` | Cloudflare R2 — storage de arquivos |
| `R2_ACCESS_KEY_ID` | Chave R2 |
| `R2_SECRET_ACCESS_KEY` | Secret R2 |
| `R2_BUCKET_NAME` | Nome do bucket R2 |
| `R2_PUBLIC_URL` | URL pública do bucket |
| `WHATSAPP_ENABLED` | Habilitar integração WhatsApp (`false`) |
| `TEMPORAL_SCHEDULER_ENABLED` | Habilitar scheduler temporal (`false`) |
| `SYNC_REDIS_ENABLED` | Habilitar sync Redis (`false`) |

> Gerar JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## 3. Healthcheck

O endpoint de healthcheck já existe no código:

```
GET /api/health
→ 200 { "status": "healthy", "uptime": <seconds>, "timestamp": "<ISO>" }
```

No Coolify, configurar:
- **Health Check Path**: `/api/health`
- **Health Check Port**: `4000`
- **Interval**: `30s` | **Timeout**: `10s` | **Start Period**: `60s`

---

## 4. Checklist pós-deploy

- [ ] App aparece como `Running` no painel Coolify
- [ ] `GET https://<dominio>/api/health` retorna `200`
- [ ] `GET https://<dominio>/api/v1` retorna `200`
- [ ] Logs não mostram erros de `[CONFIG] FATAL ERROR`
- [ ] Conexão com MongoDB estabelecida (`[DB] ✅ Conexão estabelecida`)
- [ ] Socket.IO disponível (aparece no log de startup)

---

## 5. Testar localmente com Docker

```bash
# Build da imagem (rodar a partir da raiz do monorepo)
docker build -t inmidia-backend ./BECKEND

# Rodar com .env
docker run --env-file BECKEND/.env -p 4000:4000 inmidia-backend

# Testar healthcheck
curl http://localhost:4000/api/health

# Ou testar só o build TypeScript antes do Docker
cd BECKEND
npm ci
npm run build
```

---

## 6. Notas importantes

**Puppeteer / PDF**: A imagem instala `chromium` via `apt-get` e configura `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`. Não usar Alpine (falta de dependências glibc).

**Redis**: Se não configurar Redis, o token blacklist cai para modo in-memory (warning no log) e o BullMQ pode falhar. Para produção, subir Redis como serviço separado no Coolify e apontar `REDIS_URL`.

**CORS**: Em produção, `CORS_ORIGIN` deve conter a URL exata do frontend (sem barra no final). Múltiplas origens: separar por vírgula — ex: `https://app.com,https://www.app.com`.

**Build context**: O `build context` no Coolify deve ser `BECKEND/` (não a raiz do monorepo), pois o `.dockerignore` e os `COPY` no Dockerfile são relativos ao contexto.
