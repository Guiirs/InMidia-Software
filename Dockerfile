# Multistage Dockerfile for Node.js TypeScript application

# Stage 1: Builder
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files from BECKEND
COPY BECKEND/package*.json ./BECKEND/

# Install all dependencies (including dev dependencies for building)
RUN cd BECKEND && npm ci --only=production=false

# Copy source code
COPY BECKEND/ ./BECKEND/

# Build TypeScript from BECKEND directory
RUN cd BECKEND && npm run build

# Stage 2: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY BECKEND/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Remove unnecessary files from node_modules
RUN find node_modules -type f \( -name "*.md" -o -name "*.map" -o -name "*.ts" \) -delete && \
    find node_modules -type d \( -name "src" -o -name "test*" -o -name "example*" \) -exec rm -rf {} + 2>/dev/null || true

# Stage 3: Production
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/BECKEND/dist ./dist

# Copy package.json for metadata
COPY --chown=nextjs:nodejs BECKEND/package.json ./

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 4000

# Health check with proper endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const http=require('http'); const req=http.request({hostname:'localhost',port:4000,path:'/api/v1/health'},res=>{process.exit(res.statusCode===200?0:1)}); req.on('error',()=>process.exit(1)); req.end();"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "-r", "module-alias/register", "dist/shared/infra/http/server.js"]
