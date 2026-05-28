# syntax=docker/dockerfile:1.6
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# InMidia V4 — Backend · Enterprise Dockerfile
# Base:    node:20-slim (Debian Bookworm slim — não Alpine)
# Build:   Multi-stage · BuildKit cache mounts · TypeScript
# Runtime: Non-root · dumb-init PID 1 · Coolify-compatible healthcheck
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  STAGE 1 · deps                                                            ║
# ║  Instala apenas dependências de produção (--omit=dev).                     ║
# ║  Stage isolado: seu cache sobrevive a mudanças no código-fonte.            ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
FROM node:20-slim AS deps

WORKDIR /app

# Deve ser declarado ANTES do npm ci para interceptar o script postinstall.
# Puppeteer (dep direta) e whatsapp-web.js (que puxa puppeteer como dep
# transitiva) tentam baixar ~300MB de Chromium durante o postinstall.
# Estas variáveis desabilitam o download sem remover o pacote.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    npm_config_update_notifier=false

COPY package*.json ./

# --mount=type=cache: persiste ~/.npm entre builds (feature do BuildKit).
# Em cache hit, npm resolve localmente em vez de bater no registry.
# Reduz tempo de install de ~3 min → ~20s em builds subsequentes.
# --no-audit: desabilita security audit durante install (corre separado no CI).
# --no-fund: suprime mensagens de funding que poluem o build log.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  STAGE 2 · builder                                                         ║
# ║  Compila TypeScript com devDeps completos.                                 ║
# ║  Stage separado: não contamina a imagem final com ferramentas de build.    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
FROM node:20-slim AS builder

WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    npm_config_update_notifier=false

COPY package*.json ./

# Install completo (com devDeps) necessário para o compilador TypeScript.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Copia tsconfig antes do src para maximizar granularidade do cache.
# Se apenas o tsconfig mudar, a layer de src é reaproveitada e vice-versa.
COPY tsconfig.json ./
COPY src ./src

# Compila TypeScript → dist/
RUN npm run build

# Remove artefatos inúteis em runtime do dist compilado:
#   *.js.map   → source maps de JavaScript (information disclosure + ~30% tamanho)
#   *.d.ts     → declarações TypeScript (Node.js nunca carrega em runtime)
#   *.d.ts.map → source maps das declarações
# Para error tracking com source maps, use integração Sentry + upload de maps
# no CI, sem precisar incluí-los na imagem de produção.
RUN find dist -type f \( -name "*.map" -o -name "*.d.ts" \) -delete

# Certificados customizados de MongoDB (quando usados por DB_TLS_CA_FILE).
# O TypeScript não copia arquivos não-TS para dist, então preservamos o diretório
# esperado em runtime e copiamos qualquer CA versionado em src/shared/infra/db/certs.
RUN mkdir -p dist/shared/infra/db/certs \
    && if [ -d src/shared/infra/db/certs ]; then cp -R src/shared/infra/db/certs/. dist/shared/infra/db/certs/; fi


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  STAGE 3 · production                                                      ║
# ║  Imagem final mínima. Sem ferramentas de build. Sem devDeps.               ║
# ║  Sem código-fonte TypeScript. Sem source maps.                             ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
FROM node:20-slim AS production

# ── Labels OCI ────────────────────────────────────────────────────────────────
# Rastreabilidade da imagem: qual serviço, qual vendor, qual base.
# Em produção, adicione: image.version, image.revision (git SHA), image.created.
LABEL org.opencontainers.image.title="inmidia-backend" \
      org.opencontainers.image.vendor="InMidia" \
      org.opencontainers.image.base.name="docker.io/library/node:20-slim"

# ── Usuário non-root ──────────────────────────────────────────────────────────
# Criado ANTES do WORKDIR para que os COPY --chown subsequentes funcionem.
# /sbin/nologin: impede login interativo via shell — reduz superfície de ataque.
# --no-create-home: conta de serviço não precisa de home directory.
RUN groupadd --gid 1001 nodejs \
    && useradd --uid 1001 \
               --gid nodejs \
               --shell /sbin/nologin \
               --no-create-home \
               appuser

# ── Pacotes de sistema ────────────────────────────────────────────────────────
# dumb-init: init system leve para containers.
#   Problema sem ele: Node.js vira PID 1 e não encaminha SIGTERM para
#   subprocessos. Docker manda SIGTERM → Node ignora → timeout → SIGKILL →
#   shutdown abrupto → requests em voo dropados → possível corrupção de estado.
#   Com dumb-init: SIGTERM chega ao Node → graceful shutdown ocorre corretamente.
#   Crítico para zero-downtime rolling deploys no Coolify.
#
# curl: necessário para o HEALTHCHECK do Coolify.
#   wget não está presente no node:20-slim. curl é menor e suficiente.
#
# ca-certificates: âncoras TLS para HTTPS (AWS S3, MongoDB Atlas, APIs externas).
#   Já presentes no slim, mas incluído explicitamente para clareza.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       curl \
       dumb-init \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

# ── Variáveis de ambiente ─────────────────────────────────────────────────────
# NODE_ENV=production: ativa otimizações de frameworks (Express, Mongoose etc.).
# PORT=4000: valor padrão explícito (pode ser sobrescrito pelo Coolify).
# PUPPETEER_SKIP_*: defensivo — impede qualquer tentativa de download em runtime.
# NODE_NO_WARNINGS=1: suprime deprecation warnings que poluem logs de produção.
# npm_config_update_notifier=false: silencia checagem de update do npm.
ENV NODE_ENV=production \
    PORT=4000 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_NO_WARNINGS=1 \
    npm_config_update_notifier=false

# ── Cópia dos artefatos ───────────────────────────────────────────────────────
# COPY --chown define ownership atomicamente durante a cópia.
# Isso evita um `RUN chown -R` posterior que criaria um layer extra
# com metadata de TODOS os inodes do node_modules, quase dobrando o tamanho
# efetivo das layers afetadas.
COPY --from=deps    --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist        ./dist

# package.json é necessário em runtime: module-alias lê _moduleAliases dele.
# package-lock.json NÃO é necessário em runtime.
COPY --chown=appuser:nodejs package.json ./

# ── Diretório de logs ─────────────────────────────────────────────────────────
# Combinado em único RUN para não criar layer extra.
# Executado como root (antes do USER) para ter permissão de criar e ceder.
RUN mkdir -p logs \
    && chown appuser:nodejs logs

# ── Drop de privilégios ───────────────────────────────────────────────────────
USER appuser

EXPOSE 4000

# ── Healthcheck ───────────────────────────────────────────────────────────────
# curl flags:
#   -f: falha com exit code não-zero em respostas HTTP 4xx/5xx
#   -s: silencia barra de progresso (limpa os logs)
#   -S: mostra mensagem de erro mesmo com -s (útil para debugging)
#
# Timings ajustados para Coolify + MongoDB Atlas:
#   start-period=60s: janela de startup sem penalização de falha.
#                     Acomoda handshake TLS com Atlas + warm-up de conexões.
#   interval=30s:     frequência de verificação — balance entre detecção rápida
#                     e overhead de CPU/rede.
#   timeout=8s:       deve ser < interval. 8s é conservador para uma rota /health.
#   retries=3:        3 falhas consecutivas → container marcado unhealthy.
HEALTHCHECK --interval=30s --timeout=8s --start-period=60s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

# ── Entrypoint com init system ────────────────────────────────────────────────
# dumb-init como PID 1:
#   - Encaminha SIGTERM/SIGINT ao processo Node.js filho
#   - Reapa processos zumbi (importante com uso de child_process/spawn)
#   - Permite graceful shutdown real durante rolling deploys
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Mantido exatamente como exigido: module-alias/register resolve os aliases
# definidos em _moduleAliases do package.json antes de carregar o servidor.
CMD ["node", "-r", "module-alias/register", "dist/shared/infra/http/server.js"]
