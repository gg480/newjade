# ---- Stage 1: Dependencies ----
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile && \
    npx prisma generate

# ---- Stage 2: Build ----
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate && \
    pnpm build

# ---- Stage 3: Production ----
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install su-exec for privilege dropping (lightweight sudo alternative)
RUN apk add --no-cache su-exec

WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=5000
ENV HOSTNAME="0.0.0.0"
# PUID/PGID for NAS permission compatibility
# Default 0 = run as root (simplest, no permission issues)
# Set to your NAS user id (e.g. 1000:1000) for tighter security
ENV PUID=0
ENV PGID=0

# Copy application files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./

# Create data directories and set permissions
RUN mkdir -p /app/data/db /app/data/images /app/data/logs && \
    chmod -R 777 /app/data

# Copy and set up entrypoint script
COPY --from=builder /app/scripts/entrypoint.sh /app/scripts/entrypoint.sh
RUN chmod +x /app/scripts/entrypoint.sh

# Single volume for all persistent data (db + images + logs)
VOLUME ["/app/data"]

# Container starts as root (for chown/permission fix), entrypoint drops to PUID if set
EXPOSE 5000

ENTRYPOINT ["/app/scripts/entrypoint.sh"]
