#!/bin/bash
set -e

# Ensure DATABASE_URL is set for all steps
export DATABASE_URL="${DATABASE_URL:-file:./db/custom.db}"

echo "=== Step 1: Install dependencies ==="
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "=== Step 2: Generate Prisma Client ==="
npx prisma generate

echo "=== Step 3: Push database schema ==="
npx prisma db push 2>/dev/null || true

echo "=== Step 4: Build Next.js ==="
pnpm run build

echo "=== Deploy build completed successfully ==="
