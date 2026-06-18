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

# 安装依赖（含 devDeps，Next.js 构建需要 TypeScript）
RUN pnpm install --no-frozen-lockfile && \
    npx prisma generate

# 设置生产环境变量（影响 Next.js 构建优化路径）
ENV NODE_ENV=production

# 复制全部源代码
COPY . .

# Build prisma client and next production bundle
RUN npx prisma generate && \
    npx next build

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
# .next — Next.js 构建产物（standalone 模式启动需要）
COPY --from=builder /app/.next ./.next
# prisma — Schema + migration 文件（运行时 prisma generate 需要）
COPY --from=builder /app/prisma ./prisma
# node_modules — 运行时依赖
COPY --from=builder /app/node_modules ./node_modules
# package.json — 脚本入口定义
COPY --from=builder /app/package.json ./package.json
# public — 静态资源（含 version.json）
COPY --from=builder /app/public ./public
# entrypoint — 启动脚本（含备份/迁移/验证逻辑）
COPY scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# 写入构建时版本信息（由 CI 传入或 git 自动获取）
ARG BUILD_TIME
ARG GIT_SHA
ARG GIT_BRANCH
RUN if [ -f /app/public/version.json ]; then \
      node -e "
        const v = require('./public/version.json');
        v.buildTime = '${BUILD_TIME:-unknown}';
        v.gitSha = '${GIT_SHA:-unknown}';
        v.gitBranch = '${GIT_BRANCH:-unknown}';
        require('fs').writeFileSync('./public/version.json', JSON.stringify(v, null, 2));
      "; \
    fi

# 暴露服务端口
EXPOSE 5000

# 启动：由 entrypoint.sh 统一管理（prisma generate -> db push -> next start）
# entrypoint 已内置：目录创建、数据库备份、schema 同步、基础数据验证
CMD ["/app/entrypoint.sh"]
