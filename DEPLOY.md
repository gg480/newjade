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

### 2. 构建镜像

```bash
docker compose build
```

> 首次构建约需 2-5 分钟，取决于网络速度。

### 3. 启动服务

```bash
docker compose up -d
```

访问 **http://localhost:8080** 即可使用。

---

## 数据持久化说明

所有业务数据和图片都挂载到本地 `./data/` 目录，**删除/更新容器不会丢失数据**：

```
./data/
├── db/              ← SQLite 数据库（货品/销售/客户等全部业务数据）
│   └── custom.db
└── images/          ← 货品图片文件
    ├── item_1_*.jpg
    └── ...
```

### 持久化映射详情

| 本地路径 | 容器路径 | 内容 | 说明 |
|---------|---------|------|------|
| `./data/db/` | `/app/db/` | SQLite 数据库 | 包含全部业务数据 |
| `./data/images/` | `/app/public/images/` | 货品图片 | 上传的货品照片 |

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
git pull
docker compose build
docker compose up -d
```

> 数据目录 `./data/` 不受影响，业务数据完整保留。

---

## 备份与恢复

### 备份

```bash
# 方式1：手动复制数据目录
cp -r ./data ./backup_$(date +%Y%m%d)

# 方式2：仅备份数据库
cp ./data/db/custom.db ./backup_custom_$(date +%Y%m%d).db
```

### 恢复

```bash
# 停止服务
docker compose down

# 恢复数据
cp -r ./backup_YYYYMMDD/* ./data/

# 重启
docker compose up -d
```

### 定时自动备份（可选）

```bash
# 添加 crontab，每天凌晨3点自动备份
crontab -e
# 添加以下行：
0 3 * * * cp /path/to/jade-inventory-next/data/db/custom.db /path/to/backups/jade_$(date +\%Y\%m\%d).db
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
| `DATABASE_URL` | `file:/app/db/custom.db` | 数据库路径（一般无需修改） |
| `TZ` | `Asia/Shanghai` | 时区 |
| `PORT` | `3000` | 容器内端口（无需修改） |

---

## NAS 部署（极空间/群晖）

### 极空间 NAS

1. 在极空间「容器管理」中，选择「创建容器」
2. 镜像：先在本地构建并推送，或使用镜像导入功能
3. 端口映射：主机端口 `8080` → 容器端口 `3000`
4. **必须挂载两个目录**：

| 本地路径（NAS绝对路径） | 容器路径 | 说明 |
|----------------------|---------|------|
| `/volume1/jade-data/db` | `/app/db` | 数据库 |
| `/volume1/jade-data/images` | `/app/public/images` | 图片 |

5. 环境变量添加：`DATABASE_URL=file:/app/db/custom.db`

### 群晖 NAS

1. 打开「Container Manager」→「项目」
2. 设置项目名称和路径
3. 将 `docker-compose.yml` 内容粘贴
4. 修改 volumes 路径为群晖绝对路径，例如：
   ```yaml
   volumes:
     - /volume1/docker/jade/db:/app/db
     - /volume1/docker/jade/images:/app/public/images
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

### 数据库错误

```bash
# 进入容器检查
docker compose exec jade-inventory sh
ls -la /app/db/          # 检查数据库文件
npx prisma db push       # 手动同步数据库结构
```

### 图片不显示

```bash
# 检查图片目录挂载
docker compose exec jade-inventory ls -la /app/public/images/
```

---

## 架构说明

```
浏览器 (手机/电脑)
    │
    ▼ http://localhost:8080
Docker 容器 (Next.js standalone)
    ├── :3000            → Next.js 服务
    ├── /app/db/         → SQLite 数据库（挂载到本地）
    └── /app/public/images/ → 图片文件（挂载到本地）
    │
    ▼ 持久化
本地 ./data/
├── db/custom.db
└── images/
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
