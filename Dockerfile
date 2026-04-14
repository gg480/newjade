# ===== Jade Inventory - Next.js Docker Image =====
# Multi-stage build for minimal image size

# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN npm install -g bun && bun install --frozen-lockfile

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time DATABASE_URL (placeholder, will be overridden at runtime)
ENV DATABASE_URL="file:./db/custom.db"
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# ---- Stage 3: Production ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and migrations for runtime db push
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create data directories and set ownership
RUN mkdir -p /app/db /app/public/images && \
    chown -R nextjs:nodejs /app/db /app/public/images /app/prisma

USER nextjs

EXPOSE 3000

# Startup: run prisma db push then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
