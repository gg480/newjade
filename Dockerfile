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

# 先复制依赖清单，利用 Docker 层缓存
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装依赖 + 生成 Prisma Client
RUN pnpm install --frozen-lockfile && \
    npx prisma generate

# 复制全部源代码
COPY . .

# 构建 Next.js 生产包（npx next build 直调，避免 pnpm workspace 干扰）
RUN npx prisma generate && \
    npx next build

# ---- Stage 2: Runner（最小运行时） ----
FROM node:22-alpine AS runner

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV DATABASE_URL=file:./db/custom.db

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

# 创建数据库持久化目录（通过 volume 挂载）
RUN mkdir -p /app/db

# 暴露服务端口
EXPOSE 5000

# 启动：Prisma Client 就绪后，先同步数据库结构再启动服务
# db push 确保 schema 变更（如新增 users 表）应用到已有数据库
# pnpm 下 node_modules/.bin/next 是 shell 脚本，必须用 npx 调用
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && DATABASE_URL=file:./data/db/custom.db npx next start -p 5000"]
