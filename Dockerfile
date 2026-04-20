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

# Pre-compile seed script to JS (no tsx needed at runtime)
RUN npx esbuild prisma/seed-base.ts \
    --bundle --platform=node --format=cjs \
    --outfile=prisma/seed-base.js \
    --external:@prisma/client

# ---- Stage 3: Production (minimal) ----
FROM node:22-alpine AS runner

# Install su-exec for privilege dropping + sqlite tools + pinned Prisma CLI
# Keep Prisma CLI major version aligned with @prisma/client in package.json
ARG PRISMA_CLI_VERSION=6.11.1
RUN apk add --no-cache su-exec && \
    npm install -g prisma@${PRISMA_CLI_VERSION}

WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=5000
ENV HOSTNAME="0.0.0.0"
ENV PUID=0
ENV PGID=0

# Copy standalone Next.js output (includes minimal node_modules for app)
COPY --from=builder /app/.next/standalone ./
# Copy static assets (not included in standalone)
COPY --from=builder /app/.next/static ./.next/static
# Copy public folder
COPY --from=builder /app/public ./public
# Copy Prisma schema + compiled seed for runtime db init
COPY --from=builder /app/prisma ./prisma
# Copy entrypoint script
COPY --from=builder /app/scripts/entrypoint.sh /app/scripts/entrypoint.sh

# Create data directories and set permissions
RUN mkdir -p /app/data/db /app/data/images /app/data/logs && \
    chmod -R 777 /app/data && \
    chmod +x /app/scripts/entrypoint.sh

# Single volume for all persistent data
VOLUME ["/app/data"]

EXPOSE 5000

ENTRYPOINT ["/app/scripts/entrypoint.sh"]
