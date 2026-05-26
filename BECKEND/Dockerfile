# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Skip Puppeteer's bundled Chromium download during npm install
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./

# Install all deps (devDeps needed for TypeScript compilation)
RUN npm ci

COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:20-slim AS production

# Install Chromium (used by Puppeteer for PDF generation) + ca-certificates
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       chromium \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Puppeteer: skip bundled Chrome, point to system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

COPY package*.json ./

# Production dependencies only
RUN npm ci --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Writable logs directory
RUN mkdir -p logs

# Run as non-root for security
RUN groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home appuser \
    && chown -R appuser:nodejs /app

USER appuser

EXPOSE 4000

# Health check against the existing /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 4000) + '/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "-r", "module-alias/register", "dist/shared/infra/http/server.js"]
