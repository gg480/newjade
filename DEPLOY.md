# 玉器店进销存管理系统 — Docker 部署指南

## 系统要求

| 组件 | 最低版本 |
|------|---------|
| Docker | 20.10+ |
| Docker Compose | V2（docker compose 命令） |
| 磁盘空间 | 500MB（镜像 + 数据） |
| 内存 | 512MB+ |

---

## 快速部署（3 步启动）

### 1. 克隆仓库

```bash
git clone https://github.com/gg480/jade-inventory-next.git
cd jade-inventory-next
```

### 2. 配置 NAS 环境变量

```bash
cp .env.nas.example .env
# 按你的 NAS 实际绝对路径修改 .env
```

> 建议将 `JADE_IMAGE` 指向 GitHub Actions 构建出的 `sha-xxxx` 标签，避免 `latest` 漂移。

### 3. 启动服务

```bash
docker compose pull
docker compose up -d
```

访问 **http://localhost:5000** 即可使用。

---

## 数据持久化说明

业务数据支持分目录挂载（推荐 SSD/HDD 分离），**删除/更新容器不会丢失数据**：

```
./jade-ssd/
├── db/              ← SQLite 数据库（货品/销售/客户等全部业务数据）
│   └── custom.db
├── logs/            ← 日志目录（预留）
├── backups/         ← 恢复前自动备份目录
└── config/          ← 配置目录（预留）

./jade-hdd/
└── images/          ← 货品图片文件
    ├── item_1_*.jpg
    └── ...
```

### 持久化映射详情

| 本地路径 | 容器路径 | 内容 | 说明 |
|---------|---------|------|------|
| `./jade-ssd/db/` | `/app/data/db/` | SQLite 数据库 | 核心业务数据，建议 SSD |
| `./jade-hdd/images/` | `/app/data/images/` | 货品图片 | 建议 HDD |
| `./jade-ssd/logs/` | `/app/data/logs/` | 日志目录 | 预留 |
| `./jade-ssd/backups/` | `/app/backups/` | 恢复前自动备份 | 预留 |
| `./jade-ssd/config/` | `/app/config/` | 配置目录 | 预留 |

> **重要**：首次启动时，系统会自动创建数据库和目录。后续升级镜像只需 `docker compose up -d`，数据完整保留。

---

## 常用操作

### 查看运行状态

```bash
docker compose ps
docker compose logs -f          # 查看实时日志
docker compose logs --tail 50   # 查看最近50行日志
```

### 重启服务

```bash
docker compose restart
```

### 停止服务

```bash
docker compose down             # 停止并删除容器（数据不受影响）
```

### 更新到最新版本

```bash
git pull                           # 更新 compose / 文档
docker compose pull                # 拉取新镜像（建议固定 sha tag）
docker compose up -d
```

> 数据目录 `./jade-ssd/` 和 `./jade-hdd/` 不受影响，业务数据完整保留。

---

## 备份与恢复

### 备份

```bash
# 方式1：手动复制数据目录
cp -r ./jade-ssd ./backup_ssd_$(date +%Y%m%d)

# 方式2：仅备份数据库
cp ./jade-ssd/db/custom.db ./backup_custom_$(date +%Y%m%d).db
```

### 恢复

```bash
# 停止服务
docker compose down

# 恢复数据库（示例）
cp /path/to/backup/custom.db ./jade-ssd/db/custom.db

# 重启
docker compose up -d
```

### 应急恢复（加载已有备份 DB）

当新镜像升级后出现“页面可打开但数据加载失败”时，可按以下顺序快速恢复：

```bash
# 1) 停止容器
docker compose down

# 2) 放置已验证可用的备份库到数据库挂载目录
cp /path/to/your_backup.db ./jade-ssd/db/custom.db

# 3) 启动服务并观察日志
docker compose up -d
docker compose logs --tail 120 jade-inventory

# 4) 连通性检查（核心 API）
sh scripts/nas-healthcheck.sh http://127.0.0.1:5000
```

### 定时自动备份（可选）

```bash
# 添加 crontab，每天凌晨3点自动备份
crontab -e
# 添加以下行：
0 3 * * * cp /path/to/jade-inventory-next/jade-ssd/db/custom.db /path/to/backups/jade_$(date +\%Y\%m\%d).db
```

---

## 自定义配置

### 修改端口

编辑 `docker-compose.yml` 中的 `ports`：

```yaml
ports:
  - "9090:3000"    # 改为你想要的端口
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATA_DIR` | `/app/data` | 数据根目录（db/images/logs） |
| `BACKUP_DIR` | `/app/backups` | 恢复前自动备份目录 |
| `TZ` | `Asia/Shanghai` | 时区 |
| `PORT` | `5000` | 容器内端口（通常无需修改） |
| `JADE_IMAGE` | `...:latest` | 生产建议固定为 `sha-xxxx` 标签 |
| `JADE_DB_DIR` | `./jade-ssd/db` | 建议改 NAS 绝对路径 |
| `JADE_IMAGE_DIR` | `./jade-hdd/images` | 建议改 NAS 绝对路径 |

---

## NAS 部署（极空间/群晖）

### 极空间 NAS

1. 在极空间「容器管理」中，选择「创建容器」
2. 镜像：先在本地构建并推送，或使用镜像导入功能
3. 端口映射：主机端口 `5000` → 容器端口 `5000`
4. **建议挂载多个目录（支持 SSD/HDD 分盘）**：

| 本地路径（NAS绝对路径） | 容器路径 | 说明 |
|----------------------|---------|------|
| `/volumeSSD/jade/db` | `/app/data/db` | 数据库（SSD） |
| `/volumeHDD/jade/images` | `/app/data/images` | 图片（HDD） |
| `/volumeSSD/jade/logs` | `/app/data/logs` | 日志 |
| `/volumeSSD/jade/backups` | `/app/backups` | 恢复前备份 |
| `/volumeSSD/jade/config` | `/app/config` | 配置（预留） |

5. 环境变量添加：`DATA_DIR=/app/data`、`BACKUP_DIR=/app/backups`

### 群晖 NAS

1. 打开「Container Manager」→「项目」
2. 设置项目名称和路径
3. 将 `docker-compose.yml` 内容粘贴
4. 修改 volumes 路径为群晖绝对路径，例如：
   ```yaml
   volumes:
     - /volumeSSD/docker/jade/db:/app/data/db
     - /volumeHDD/docker/jade/images:/app/data/images
     - /volumeSSD/docker/jade/logs:/app/data/logs
     - /volumeSSD/docker/jade/backups:/app/backups
   ```
5. 启动项目

---

## 故障排查

### 容器启动失败

```bash
docker compose logs jade-inventory   # 查看错误日志
```

常见原因：
- 端口被占用：修改 `docker-compose.yml` 中的主机端口
- 数据目录权限不足：`chmod -R 777 ./data`
- Prisma 参数不兼容：若日志出现 `unknown or unexpected option: --skip-generate`，请升级到最新镜像（已移除该参数）
- Prisma 主版本漂移：若日志出现 `Prisma CLI Version: 7.x` 且 schema 校验失败，请升级到锁定版本镜像（运行时已固定 Prisma 6.11.1）

### 数据库错误

```bash
# 进入容器检查
docker compose exec jade-inventory sh
ls -la /app/data/db/     # 检查数据库文件
npx prisma db push       # 手动同步数据库结构
```

### 图片不显示

```bash
# 检查图片目录挂载
docker compose exec jade-inventory ls -la /app/data/images/
```

### 页面提示“数据加载失败”

```bash
# 1) 核心健康检查
curl -s http://127.0.0.1:5000/api/health

# 2) 看板接口检查（常见首个报错来源）
curl -s "http://127.0.0.1:5000/api/dashboard/summary?aging_days=90"

# 3) 关键数据接口检查
curl -s "http://127.0.0.1:5000/api/items?page=1&size=1"
curl -s "http://127.0.0.1:5000/api/sales?page=1&size=1"

# 4) 对照容器日志
docker compose logs --tail 200 jade-inventory
```

---

## 回滚机制（镜像 / 数据 / 配置）

### 镜像回滚（推荐）

1. 将 `.env` 中 `JADE_IMAGE` 改回上一个可用 `sha-xxxx` 标签  
2. 执行 `docker compose pull && docker compose up -d`

### 数据回滚

1. `docker compose down`  
2. 用备份库覆盖 `./jade-ssd/db/custom.db`  
3. `docker compose up -d`

### 配置回滚

保持 `docker-compose.yml` 与 `.env` 版本化（Git 管理），出现异常时回退到上一个已验证提交。

---

## 架构说明

```
浏览器 (手机/电脑)
    │
    ▼ http://localhost:8080
Docker 容器 (Next.js standalone)
    ├── :5000               → Next.js 服务
    ├── /app/data/db/       → SQLite 数据库（建议 SSD）
    ├── /app/data/images/   → 图片文件（建议 HDD）
    ├── /app/data/logs/     → 日志目录
    └── /app/backups/       → 恢复前自动备份
    │
    ▼ 持久化
本地 ./jade-ssd/ + ./jade-hdd/
```

**技术栈**：
- 运行时：Node.js 20 Alpine
- 框架：Next.js 16 (standalone)
- 数据库：SQLite (Prisma ORM)
- 镜像大小：约 180MB（压缩后）

---

## 安全建议

1. **局域网部署**：系统设计为内网使用，不建议直接暴露到公网
2. **定期备份**：建议设置自动备份（见上方备份章节）
3. **端口安全**：使用非标准端口（非80/443）可减少扫描风险
