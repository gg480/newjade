# ---- Stage 1: Dependencies ----
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile && \
    npx prisma generate

# ---- Stage 2: Build ----
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate && \
    pnpm build

# ---- Stage 3: Production ----
FROM node:24-alpine AS runner
RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=file:./db/custom.db
ENV DATA_DIR=/app/data
ENV PORT=5000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy all necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./

# Create data directories with write permissions
RUN mkdir -p /app/data/images /app/db && \
    chown -R nextjs:nodejs /app/data /app/db

# Data volumes: database + uploaded images
VOLUME ["/app/data", "/app/db"]

USER nextjs

EXPOSE 5000

CMD ["pnpm", "run", "start"]
