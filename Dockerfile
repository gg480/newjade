# ============================================================
# Jade ERP - 极空间 NAS Docker 部署
# 多架构支持：x86_64 + ARM64
# 构建命令：docker buildx build --platform linux/amd64,linux/arm64
# ============================================================

# ---- Stage 1: Builder ----
# 使用 BUILDPLATFORM 让构建在宿主机原生架构上执行（速度快）
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

# 声明目标平台参数（供构建时交叉编译判断）
ARG TARGETPLATFORM
ARG BUILDPLATFORM

# 安装 pnpm（固定 v9 避免 v10+ build scripts 审批问题）
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# 设置生产环境变量（影响 Next.js 构建优化路径）
ENV NODE_ENV=production

# 先复制依赖清单，利用 Docker 层缓存
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装依赖 + 生成 Prisma Client
RUN pnpm install --frozen-lockfile && \
    npx prisma generate

# 复制全部源代码
COPY . .

# 构建 Next.js 生产包（直接调用 node_modules/.bin 避免 npx 版本冲突）
# 2026-06-06: fix Docker build cache staleness causing npx/npm resolution failures
RUN node_modules/.bin/prisma generate && \
    node_modules/.bin/next build

# ---- Stage 2: Runner（最小运行时） ----
FROM node:22-alpine AS runner

WORKDIR /app

# 安装运行时工具
# sqlite: 数据库一致性备份 (.backup API)
# su-exec: PUID/PGID 用户切换（entrypoint.sh 需要）
RUN apk add --no-cache sqlite su-exec

# 设置环境变量
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

# 从 Builder 复制必要文件
# .next —— Next.js 构建产物（standalone 模式启动需要）
COPY --from=builder /app/.next ./.next
# prisma —— Schema + migration 文件（运行时 prisma generate 需要）
COPY --from=builder /app/prisma ./prisma
# node_modules —— 运行时依赖
COPY --from=builder /app/node_modules ./node_modules
# package.json —— 脚本入口定义
COPY --from=builder /app/package.json ./package.json
# public —— 静态资源
COPY --from=builder /app/public ./public
# entrypoint —— 启动脚本（含备份/迁移/验证逻辑）
COPY scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# 暴露服务端口
EXPOSE 5000

# 启动：由 entrypoint.sh 统一管理（prisma generate → db push → next start）
# entrypoint 已内置：目录创建、数据库备份、schema 同步、基础数据验证
CMD ["/app/entrypoint.sh"]
