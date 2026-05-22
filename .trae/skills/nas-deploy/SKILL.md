---
name: "nas-deploy"
description: "极空间 NAS + 花生壳内网穿透部署翡翠 ERP 系统。当用户提到'部署到NAS'、'极空间部署'、'花生壳部署'、'NAS上线'、'远程部署'时调用。"
---

# NAS 部署技能（极空间 + 花生壳）

将 Jade Inventory ERP 系统部署到极空间 NAS，通过花生壳内网穿透实现外网访问。

## 触发条件

- 用户提到"部署到NAS"、"极空间部署"、"花生壳部署"、"NAS上线"、"远程部署"
- Sprint 完成需要上线生产环境时，由 devops-engineer 调用

**使用者**：`devops-engineer`（执行）、`qa-engineer`（验证）

## 前置条件

- 项目 `pnpm lint` + `pnpm build` 通过
- E2E 测试通过（`npx tsx tests/e2e-click-test.ts`）
- 极空间 NAS 已通电联网，管理员账号可登录
- 花生壳账号已注册（https://console.oray.com）

---

## 极空间 NAS 存储池路径识别

极空间 NAS 使用 ZFS 文件系统，物理磁盘通过存储池挂载。Docker 容器中的 volume 映射需要使用 **NAS 本地绝对路径**，而非容器相对路径。

### ZFS 路径格式

```
/tmp/zfsv3/{介质类型}{盘位号}/{用户ID}/data/docker/{目录名}/...
```

**关键识别点**：

| 路径片段 | 含义 | 示例 |
|---------|------|------|
| `nvme{N}` | NVMe SSD 盘位 | `nvme12` = 第 12 个 NVMe 插槽（SSD，高性能） |
| `sata{N}` | SATA 盘位 | `sata11` = 第 11 个 SATA 插槽（HDD，大容量） |

### 如何查看自己的存储池路径

1. 登录极空间 Web 管理后台
2. 进入"文件管理"或"Docker → 容器 → 添加容器 → 卷挂载"
3. 浏览文件系统，找到目标目录的完整路径
4. **不同型号 NAS 的存储池路径不同**，不可直接照搬他人路径

### 路径硬规则

- 必须使用**以 `/tmp/zfsv3/` 开头的绝对路径**，相对路径（如 `./db`）在极空间 Docker 中不工作
- 必须提前在 NAS 文件管理中**手动创建目标目录**，Docker 不会自动创建
- 路径中包含的用户 ID（如 `13143360616`）是极空间账号唯一标识，不同账号不同

---

## 分层存储最佳实践

### 核心原则

> **需要"快"的数据放 SSD，需要"大"的数据放 HDD。**

### 按数据类型分配介质

| 数据类型 | 推荐介质 | I/O 特征 | 理由 |
|---------|:---:|------|------|
| **数据库文件** (SQLite `.db`) | NVMe SSD | 随机读写，高频小 I/O | 每次 CRUD 都打磁盘，SSD 延迟直接决定 API 响应速度。SQLite 单文件模式下尤其敏感 |
| **应用日志** (`.log`) | NVMe SSD | 高频小文件追加写 | 日志写入不阻塞请求，SSD 避免成为瓶颈 |
| **系统配置** | NVMe SSD | 低频小文件随机读 | 体积小（KB 级），但启动和配置变更时频繁读取 |
| **数据库备份** (`.db`) | NVMe SSD | 低频大文件顺序写 | 虽不频繁但写入窗口要求快（凌晨秒级完成），且备份文件通常不大（几百 MB） |
| **货品图片** (`.jpg/.png`) | SATA HDD | 低频大文件顺序读写 | 写入一次后主要读取，HDD 容量大、成本低。翡翠图片 1-5MB/张，总量可达几十 GB |

### 典型 NAS 生产级 volume 映射

```
容器内路径                    NAS 本地路径                          介质
──────────────────────────────────────────────────────────────────────────
/app/data/db       →  /tmp/zfsv3/nvme12/{uid}/data/docker/Xing/data/db        NVMe SSD
/app/data/logs     →  /tmp/zfsv3/nvme12/{uid}/data/docker/Xing/log            NVMe SSD
/app/backups       →  /tmp/zfsv3/nvme12/{uid}/data/docker/Xing/backup         NVMe SSD
/app/config        →  /tmp/zfsv3/nvme12/{uid}/data/docker/Xing/config         NVMe SSD
/app/data/images   →  /tmp/zfsv3/sata11/{uid}/data/xing/image                 SATA HDD
```

### 反模式（避免）

- 把数据库放 HDD：API 响应延迟从毫秒级恶化到秒级
- 把图片放 SSD：SSD 容量小（通常 256GB-1TB），大量图片会占满 SSD 影响数据库性能
- 所有数据扔一个目录不分层：无法享受混合介质的性价比优势

---

## Phase 0：前置检查

### 0.1 NAS 环境确认

```bash
# 确认 NAS 型号及 CPU 架构
# 登录极空间 Web 管理后台 → 系统设置 → 设备信息 → 查看 CPU 型号
# Intel/AMD → x86_64；ARM → ARM64
```

检查清单：

| 检查项 | 验证方式 | 预期 |
|--------|---------|------|
| NAS 型号 | 设备信息页 | 极空间 Z4/Z4S/Z2S/Q2 等 |
| CPU 架构 | 设备信息页 | x86_64 或 ARM64（Dockerfile 使用 `node:22-alpine` 自动适配） |
| Docker 功能 | 应用中心 → Docker | 状态：已启用 |
| 存储池路径 | 文件管理 | 确认 NVMe SSD 路径（如 `/tmp/zfsv3/nvme12/...`）和 SATA HDD 路径（如 `/tmp/zfsv3/sata11/...`）可用 |
| 分层存储 | 文件管理 | 确认已按分层策略创建目录：NVMe 上建 `db/`、`logs/`、`config/`、`backups/`；HDD 上建 `images/` |

### 0.2 花生壳账号确认

```bash
# 登录花生壳控制台
# 打开 https://console.oray.com
# 确认已获取免费壳域名（格式：xxxxxx.imwork.net 或 xxxxxx.vicp.vip）
```

检查清单：

| 检查项 | 验证方式 |
|--------|---------|
| 花生壳账号 | 可正常登录 console.oray.com |
| 壳域名 | 控制台 → 域名列表 → 至少有一个可用域名 |
| 账号余额 | 如需付费版，确认余额充足 |

### 0.3 构建环境确认

```bash
# 在开发机项目根目录执行
pnpm lint --quiet
echo "Lint exit code: $?"

pnpm build
echo "Build exit code: $?"

npx tsx tests/e2e-click-test.ts
echo "E2E exit code: $?"
```

三项全部返回 `exit code: 0` 方可继续。任何一项失败则终止部署，先修复后重试。

---

## Phase 1：花生壳配置（极空间端）

### 1.1 安装花生壳插件

1. 登录极空间 Web 管理后台
2. 进入"应用中心"
3. 搜索"花生壳"或"Oray"
4. 点击安装，等待完成

验证：应用中心已安装列表中可见"花生壳"

### 1.2 登录与场景选择

1. 打开花生壳应用
2. 选择登录方式：
   - **微信扫码**（推荐，快速绑定）
   - 花生壳 APP 扫码
   - 账号密码登录
3. 登录成功后进入花生壳管理页

验证：页面显示"在线"状态

### 1.3 选择映射方案

两种方案二选一：

| 方案 | 带宽 | 流量 | 费用 | 适用场景 |
|------|------|------|------|----------|
| **极空间专属场景映射**（推荐） | 15Mbps | 500GB/月 | ~98元/年 | 日常使用，多人访问 |
| **自定义映射（免费版）** | 1Mbps | 1GB/月 | 免费 | 测试验证，极低频使用 |

> **风险提示**：免费版 1GB/月流量，ERP 单次页面加载约 2-5MB，约 200-500 次页面访问即耗尽。生产环境强烈建议选择付费版。

#### 方案 A：极空间专属场景映射（推荐）

1. 花生壳管理页 → "场景映射" → 选择"极空间专属场景"
2. 按引导完成购买（约 98 元/年）
3. 系统自动配置端口映射：内网 `5000` → 外网域名

#### 方案 B：自定义映射（免费版）

1. 花生壳管理页 → "自定义映射"
2. 点击"添加映射"
3. 配置参数：

```
应用名称：Jade ERP
内网主机：127.0.0.1（或 NAS 局域网 IP）
内网端口：5000
外网端口：随机分配（自动）
外网域名：选择已有壳域名
带宽：按套餐
```

### 1.4 HTTPS 证书

花生壳云端自动为壳域名部署 HTTPS 证书，无需手动操作。

验证：浏览器访问 `https://壳域名`，地址栏显示锁图标。

### 1.5 访问控制配置（可选）

1. 花生壳管理页 → 映射详情 → 访问控制
2. 可配置：
   - **IP 白名单**：仅允许特定 IP 访问
   - **口令验证**：访问时需输入预设口令

> 生产环境建议：至少开启口令验证，防止未授权访问。

---

## Phase 2：镜像构建与推送

### 2.1 项目现有 Docker 资产

项目已包含以下部署文件，可直接使用：

| 文件 | 用途 |
|------|------|
| `Dockerfile` | 多阶段构建（deps → builder → runner），基于 `node:22-alpine` |
| `docker-compose.yml` | 容器编排，含健康检查、自动重启、数据挂载 |
| `.env.nas.example` | NAS 环境变量模板 |
| `scripts/entrypoint.sh` | 容器入口：首次运行初始化 DB + seed，后续运行自动迁移 |
| `scripts/nas-healthcheck.sh` | 部署后 API 可达性检查 |
| `scripts/nas-rollback.sh` | 镜像回滚脚本 |

### 2.2 构建与推送

```bash
# Step 1：登录阿里云容器镜像仓库
docker login --username=<你的阿里云账号> crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com

# Step 2：构建镜像（项目根目录）
# 生成唯一 tag，避免 latest 漂移导致回滚困难
TAG="sha-$(git rev-parse --short HEAD)"
docker build -t crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com/jadeerp/jadeerp:${TAG} .

# Step 3：推送镜像
docker push crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com/jadeerp/jadeerp:${TAG}

# Step 4：记录本次构建的 tag（用于后续回滚）
echo "${TAG}" > .last-nas-tag
echo "[INFO] 镜像构建完成: jadeerp:${TAG}"
```

### 2.3 架构说明

`Dockerfile` 基于 `node:22-alpine`，自动适配 x86_64 和 ARM64。极空间 Z4/Z4S（x86_64）和 ARM 型号均可使用同一 Dockerfile。

关键设计：
- **多阶段构建**：最终镜像仅含 `node:22-alpine` + standalone 输出，体积小
- **数据持久化**：`/app/data` 目录（含 db/images/logs）通过 Volume 挂载到 NAS 物理路径
- **自动迁移**：entrypoint 检测已有数据库时自动执行 `prisma db push`
- **权限兼容**：支持 PUID/PGID 环境变量适配 NAS 文件权限

---

## Phase 3：容器部署

### 3.1 准备 NAS 目录结构

通过极空间文件管理（或 SSH）创建以下目录。**路径中的 `{uid}` 需替换为你的极空间用户 ID**：

```bash
# === NVMe SSD 卷（数据库、日志、配置、备份 — 需要低延迟随机 I/O）===
/tmp/zfsv3/nvme12/{uid}/data/docker/jade/data/db       # SQLite 数据库文件
/tmp/zfsv3/nvme12/{uid}/data/docker/jade/log            # 应用日志
/tmp/zfsv3/nvme12/{uid}/data/docker/jade/config         # 系统配置
/tmp/zfsv3/nvme12/{uid}/data/docker/jade/backup         # 数据库备份

# === SATA HDD 卷（图片 — 大容量顺序读写）===
/tmp/zfsv3/sata11/{uid}/data/jade/images                 # 货品图片
```

> **注意**：极空间不同型号的 `nvme{N}` 和 `sata{N}` 编号可能不同。请通过文件管理确认实际路径，切勿直接照搬。详见上方"存储池路径识别"章节。

### 3.2 生产级 Docker Compose 配置

以下是极空间 NAS 上实际运行的生产级 `docker-compose.yml` 模板。**不要直接复制使用**——需要根据你的 NAS 实际存储池路径修改 `volumes` 部分。

```yaml
services:
  jade-inventory:
    # 阿里云容器镜像仓库（ACR）— 国内拉取速度快、稳定
    image: crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com/jadeerp/jadeerp:latest
    container_name: jade-inventory
    ports:
      # 端口映射：NAS 主机 25888 → 容器内 5000
      # 使用高位端口避免与 NAS 其他服务冲突
      - "25888:5000"
    volumes:
      # === NVMe SSD（随机 I/O 密集型）===
      # SQLite 数据库 — 每次 CRUD 都打磁盘，必须 SSD
      - /tmp/zfsv3/nvme12/{uid}/data/docker/jade/data/db:/app/data/db
      # 应用日志 — 高频小文件追加写
      - /tmp/zfsv3/nvme12/{uid}/data/docker/jade/log:/app/data/logs
      # 数据库备份 — 写入窗口要求快
      - /tmp/zfsv3/nvme12/{uid}/data/docker/jade/backup:/app/backups
      # 系统配置 — 频繁读取
      - /tmp/zfsv3/nvme12/{uid}/data/docker/jade/config:/app/config

      # === SATA HDD（大容量顺序读写）===
      # 货品图片 — 写入一次后读取为主，HDD 性价比高
      - /tmp/zfsv3/sata11/{uid}/data/jade/images:/app/data/images
    environment:
      # 数据目录根路径（容器内）
      - DATA_DIR=/app/data
      # 备份目录
      - BACKUP_DIR=/app/backups
      # 生产模式
      - NODE_ENV=production
      # 权限：0 = root，解决 NAS Docker 文件权限问题
      # 安全敏感环境可改为 NAS 普通用户 uid/gid
      - PUID=0
      - PGID=0
      # 时区
      - TZ=Asia/Shanghai
    restart: unless-stopped
```

### 3.3 环境变量详解

| 变量名 | 生产环境值 | 开发环境值 | 说明 |
|--------|:---:|:---:|------|
| `DATA_DIR` | `/app/data` | （不使用） | 数据根目录，子目录 `db/`、`images/`、`logs/` 均在其下。容器内路径，**不要改** |
| `BACKUP_DIR` | `/app/backups` | （不使用） | 数据库备份目录。容器内路径，**不要改** |
| `NODE_ENV` | `production` | `production` | 设为 production 启用优化 |
| `PUID` | `0` | 不设置 | 容器进程的用户 ID。`0` = root，兼容 NAS Docker 默认权限模型。如需安全加固，改为 NAS 上实际用户的 uid（通过 `id -u` 查看） |
| `PGID` | `0` | 不设置 | 容器进程的组 ID。`0` = root。与 PUID 配对使用 |
| `TZ` | `Asia/Shanghai` | `Asia/Shanghai` | 时区，影响日志时间戳和定时任务 |
| `DATABASE_URL` | （不设置，由 entrypoint 自动生成） | `file:./db/custom.db` | 生产环境由容器内 entrypoint 脚本根据 DATA_DIR 自动拼接，无需手动设置 |

### 3.4 阿里云 ACR 镜像拉取

#### 镜像仓库信息

```
仓库地址：crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com
命名空间：jadeerp
镜像名：  jadeerp
标签：    latest（生产运行）、sha-{git_hash}（版本化，用于回滚）
```

#### 拉取前登录

```bash
# 在 NAS 上（通过 SSH 或极空间 Docker 终端）执行
docker login --username={阿里云账号} crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com
# 输入密码（阿里云容器镜像服务 → 访问凭证 中获取）
```

#### 拉取并启动

```bash
# 拉取最新镜像
docker compose pull

# 启动容器
docker compose up -d

# 查看镜像
docker images | grep jadeerp
```

#### 版本化部署（推荐，替代 latest）

生产环境不推荐使用 `latest` 标签（镜像更新后自动漂移，难以回滚）。改用 Git SHA 标签：

```bash
# 拉取指定版本
docker pull crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com/jadeerp/jadeerp:sha-{git_hash}

# 修改 docker-compose.yml 中的 image 为带 tag 的版本
# image: crpi-.../jadeerp/jadeerp:sha-abc1234

docker compose up -d
```

#### 离线导入（网络受限时）

```bash
# 在开发机上导出镜像
docker save -o jadeerp.tar crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com/jadeerp/jadeerp:latest

# 传输到 NAS（通过 SMB 共享或 U 盘）
# 在 NAS 上导入
docker load -i jadeerp.tar
```

### 3.5 旧版环境变量配置（过渡期保留）

> **注意**：以下为旧版 `.env` 文件方式配置。新部署建议直接使用 3.2 节的生产级 `docker-compose.yml`（环境变量内联在 compose 文件中，无需额外 `.env`）。旧版方式仍可用于已有 `.env` 文件的存量部署。

```bash
# 旧方式：将 .env.nas.example 复制为 .env 并按实际路径修改
cp .env.nas.example .env
```

旧版 `.env` 内容参考：

```ini
# 镜像 tag（使用 Phase 2 构建的具体 tag，不要用 latest）
JADE_IMAGE=crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com/jadeerp/jadeerp:sha-xxxxxxxx
# 对外端口
JADE_PORT=5000
# NAS 绝对路径（按实际修改 — 旧版用简写路径，新版用 ZFS 真实路径）
JADE_DB_DIR=/tmp/zfsv3/nvme12/{uid}/data/docker/jade/data/db
JADE_IMAGE_DIR=/tmp/zfsv3/sata11/{uid}/data/jade/images
JADE_LOG_DIR=/tmp/zfsv3/nvme12/{uid}/data/docker/jade/log
JADE_BACKUP_DIR=/tmp/zfsv3/nvme12/{uid}/data/docker/jade/backup
JADE_CONFIG_DIR=/tmp/zfsv3/nvme12/{uid}/data/docker/jade/config
# 权限
PUID=0
PGID=0
TZ=Asia/Shanghai
```

### 3.6 拉取镜像并启动

```bash
# 将所有文件复制到 NAS（通过 SMB 共享或 scp）
# 在 NAS 上项目目录执行：

# 拉取镜像
docker compose pull

# 启动容器
docker compose up -d

# 查看容器状态
docker compose ps

# 查看启动日志
docker compose logs -f jade-inventory
```

预期日志输出：

```
========================================
  Jade Inventory - Starting
  DATA_DIR: /app/data
  DATABASE: /app/data/db/custom.db
  PUID: 0  PGID: 0
========================================
[INFO] Database already exists at /app/data/db/custom.db
[INFO] Preserving existing data, applying schema migration if needed...
[INFO] Schema sync completed
[INFO] DictMaterial count: 9
[INFO] Starting Jade Inventory server on port 5000...
```

首次运行时会自动：
1. 创建 SQLite 数据库文件
2. 执行 `prisma db push` 建立表结构
3. 执行 `seed-base.js` 写入基础数据（材质、器型、标签、系统设置、金属价格）

### 3.7 局域网验证

```bash
# 在局域网内任意设备浏览器访问
http://NAS_IP:5000

# 或执行健康检查脚本
sh scripts/nas-healthcheck.sh http://NAS_IP:5000
```

预期输出：

```
[CHECK] Base URL: http://NAS_IP:5000
[PASS] /api/dashboard/summary -> HTTP 200
[PASS] /api/items?page=1&size=1 -> HTTP 200
[PASS] /api/sales?page=1&size=1 -> HTTP 200
[PASS] /api/config -> HTTP 200
[OK] Core APIs are reachable.
```

### 3.8 花生壳外网验证

```bash
# 在手机浏览器（断开 WiFi，使用移动数据）访问
# 地址：https://你的壳域名
```

预期：
- 页面正常加载，自动跳转登录页
- 使用 `admin` / `admin123` 登录成功
- 地址栏显示 HTTPS 锁图标

---

## Phase 4：验证测试

### 4.1 外网连通性测试

```bash
# 从外网环境（手机 4G/5G 热点）执行：
# 1. 浏览器访问 https://壳域名
# 2. 确认登录页加载完整
# 3. 登录后确认各 Tab 可切换
```

### 4.2 核心业务流程验证

走通以下完整流程（从外网环境）：

| 序号 | 操作 | 验证点 |
|------|------|--------|
| 1 | 访问 `https://壳域名` | 显示登录页 |
| 2 | 输入 `admin` / `admin123`，点击登录 | 进入工作区 |
| 3 | 切换到"库存"Tab | 库存列表正常加载 |
| 4 | 点击"新增商品" | 创建弹窗正常打开 |
| 5 | 填写商品信息，提交 | 列表刷新，新商品可见 |
| 6 | 切换到"销售"Tab | 销售记录列表正常 |
| 7 | 创建一条销售记录 | 库存扣减正确 |
| 8 | 切换到"客户"Tab | 客户列表正常 |
| 9 | 搜索已有客户 | 搜索结果正确 |

### 4.3 性能基准

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 页面首次加载 | < 3秒 | Chrome DevTools → Network → Load |
| API 响应延迟 | < 1秒 | DevTools → Network → 单个 API Time |
| 登录响应 | < 2秒 | 提交到跳转 |

> 免费版带宽 1Mbps 时页面加载可能超过 3 秒，属正常。付费版 15Mbps 应在 2 秒内。

### 4.4 容器健康检查

```bash
# 查看容器运行状态
docker compose ps

# 预期：STATUS 列显示 "Up (healthy)"
# 若显示 "unhealthy"，查看日志：
docker compose logs --tail=50 jade-inventory
```

`docker-compose.yml` 已配置健康检查：
- 每 30 秒检查 `/api/health` 端点
- 连续 5 次失败标记 unhealthy
- 启动后 60 秒开始首次检查

---

## Phase 5：运维配置

### 5.1 数据库备份策略

#### 自动备份（推荐）

在极空间 NAS 上配置定时任务：

1. 极空间管理后台 → 控制面板 → 计划任务
2. 新建任务，类型：自定义脚本
3. 设置执行周期（建议每日凌晨 3:00）

```bash
#!/bin/sh
# 每日备份 Jade ERP 数据库
BACKUP_DIR="/volumeSSD/jade/backups"
DB_PATH="/volumeSSD/jade/db/custom.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cp "${DB_PATH}" "${BACKUP_DIR}/custom_${TIMESTAMP}.db"

# 仅保留最近 7 天的备份
find "${BACKUP_DIR}" -name "custom_*.db" -mtime +7 -delete

echo "[$(date)] Backup completed: custom_${TIMESTAMP}.db"
```

#### 手动备份

```bash
# 在 NAS 上执行
docker compose exec jade-inventory cp /app/data/db/custom.db /app/backups/custom_$(date +%Y%m%d_%H%M%S).db
```

### 5.2 容器监控

```bash
# 查看容器运行状态
docker compose ps

# 查看实时日志
docker compose logs -f jade-inventory

# 查看最近 100 行日志
docker compose logs --tail=100 jade-inventory

# 查看容器资源占用
docker stats jade-inventory --no-stream

# 进入容器排查
docker compose exec jade-inventory sh
```

### 5.3 升级部署

当项目有更新时：

```bash
# Step 1：在开发机构建新镜像并推送（参考 Phase 2.2）
TAG="sha-$(git rev-parse --short HEAD)"
docker build -t crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com/jadeerp/jadeerp:${TAG} .
docker push crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com/jadeerp/jadeerp:${TAG}

# Step 2：登录 NAS，更新 .env 中的 JADE_IMAGE
# 将 JADE_IMAGE 改为新 tag

# Step 3：拉取新镜像并重启
docker compose pull
docker compose up -d

# Step 4：验证
sh scripts/nas-healthcheck.sh http://127.0.0.1:5000
```

### 5.4 故障恢复

#### 容器崩溃恢复

`docker-compose.yml` 已配置 `restart: unless-stopped`，Docker 守护进程会自动重启崩溃的容器。

手动重启：

```bash
docker compose restart jade-inventory
```

#### 数据库恢复

```bash
# 停止容器
docker compose stop jade-inventory

# 从备份恢复
cp /volumeSSD/jade/backups/custom_YYYYMMDD_HHMMSS.db /volumeSSD/jade/db/custom.db

# 重启容器
docker compose start jade-inventory

# 验证
sh scripts/nas-healthcheck.sh http://127.0.0.1:5000
```

#### 镜像回滚

```bash
# 使用 nas-rollback.sh 脚本回滚到指定版本
sh scripts/nas-rollback.sh crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com/jadeerp/jadeerp:sha-<之前的tag>

# 或手动修改 .env 后：
docker compose pull
docker compose up -d
```

#### 花生壳掉线恢复

1. 检查极空间网络连接是否正常
2. 进入极空间应用中心 → 花生壳 → 查看状态
3. 如显示"离线"，尝试：
   - 重启花生壳插件
   - 重启极空间 NAS
4. 如仍无法恢复，登录 [花生壳控制台](https://console.oray.com) 查看映射状态
5. 联系花生壳客服（如为付费用户）

### 5.5 花生壳流量监控

```bash
# 登录花生壳控制台 → 流量统计
# 免费版注意 1GB/月限制
# 付费版注意 500GB/月限制

# 建议：在 ERP 中避免上传大尺寸图片（单张 >5MB），控制流量消耗
```

---

## 附录 A：常见问题与解决方案

### Q1：花生壳插件无法扫码登录

**现象**：打开花生壳后，二维码不显示或扫码无反应。

**解决方案**：
1. 确认极空间 NAS 已连接互联网
2. 清除浏览器缓存后重新打开
3. 尝试使用花生壳 APP 扫码（先下载"花生壳管理"APP）
4. 改用账号密码登录

### Q2：外网地址无法访问

**现象**：`https://壳域名` 打不开。

**排查步骤**：
1. 确认局域网 `http://NAS_IP:5000` 可正常访问（确认容器正常）
2. 确认花生壳管理页显示"在线"
3. 确认端口映射配置正确：内网端口 `5000`
4. 确认 NAS 防火墙未阻止 5000 端口
5. 等待 2-5 分钟（DNS 和端口映射可能需要时间生效）

### Q3：访问速度慢

**现象**：页面加载超过 5 秒。

**排查**：
1. 免费版带宽仅 1Mbps，属正常
2. 检查首页是否有大图片加载
3. 在 Chrome DevTools → Network 中找出慢请求
4. 考虑升级到付费版（15Mbps）

### Q4：HTTPS 证书问题

**现象**：浏览器提示"不安全"或证书错误。

**解决方案**：
1. 花生壳 HTTPS 证书通常自动部署，等待 5-10 分钟
2. 确认使用的是 `https://` 而非 `http://`
3. 清除浏览器缓存
4. 如问题持续，在花生壳控制台 → 域名管理 → 手动刷新证书

### Q5：极空间重启后花生壳未自动恢复

**现象**：NAS 重启后外网无法访问。

**解决方案**：
1. 确认花生壳插件已设为"开机自启"（极空间 → 应用中心 → 花生壳 → 设置）
2. 确认 Docker 容器已自动启动（`docker compose ps`）
3. 手动重启花生壳插件
4. 等待 2-3 分钟让映射重新生效

### Q6：免费版流量超限

**现象**：外网访问中断，花生壳提示"流量已用完"。

**解决方案**：
1. 等待次月 1 日流量重置
2. 或升级到付费版立即恢复
3. 如必须继续使用免费版：减少外网访问频率，主要操作在局域网完成

### Q7：Docker 镜像拉取失败

**现象**：`docker compose pull` 报网络错误。

**解决方案**：
1. 确认 NAS 能正常访问外网
2. 在极空间 Docker 设置中配置镜像加速器
3. 阿里云容器镜像仓库国内访问通常稳定，如失败可能是 DNS 问题：
   ```bash
   # 在 NAS 上 Ping 验证
   ping crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com
   ```
4. 手动下载镜像的 tar 包后导入：
   ```bash
   docker save -o jadeerp.tar crpi-xxx/jadeerp/jadeerp:sha-xxx
   # 传输到 NAS 后
   docker load -i jadeerp.tar
   ```

### Q8：数据库迁移失败

**现象**：容器启动日志显示 `Schema migration had issues`。

**解决方案**：
1. 数据库文件权限问题：确认 `PUID`/`PGID` 设置正确
2. 数据库文件损坏：从备份恢复
3. Prisma schema 有破坏性变更：手动处理迁移
   ```bash
   docker compose exec jade-inventory sh
   # 进入容器后
   cd /app
   npx prisma db push --accept-data-loss
   ```

---
## 附录 B：Docker 构建踩坑记录（务必注意）

以下是历次 Docker 构建中实际遇到的错误及解决方案。每次新增坑位都应记录于此，避免团队重复踩坑。

### 🕳️ 坑位 #1：pnpm v10+ Build Scripts 审批拦截（2026-05-22）

**现象**：
```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @parcel/watcher@..., @prisma/client@..., bcrypt@..., prisma@..., sharp@..., ...
ERROR: process "/bin/sh -c pnpm install --frozen-lockfile && npx prisma generate" did not complete successfully: exit code: 1
```

**根因**：pnpm v10+ 新增安全特性，默认拦截所有 native build scripts（bcrypt、prisma、sharp 等）。Docker 容器中 `pnpm install` 无交互终端，无法审批，直接构建失败。

**修复**：Dockerfile 中固定使用 **pnpm@9**，v9 不强制审批 build scripts。

```dockerfile
# 错误（v10+ 会拦截 build scripts）
RUN corepack enable && corepack prepare pnpm@latest --activate

# 正确（固定 v9）
RUN corepack enable && corepack prepare pnpm@9 --activate
```

同时在 `package.json` 中声明 `packageManager` 保持一致性：
```json
"packageManager": "pnpm@9.15.4"
```

---

### 🕳️ 坑位 #2：pnpm-workspace.yaml 导致 `pnpm build` 报错（2026-05-22）

**现象**：
```
ERROR  packages field missing or empty
ERROR: process "/bin/sh -c npx prisma generate && pnpm build" did not complete successfully: exit code: 1
```

**根因**：项目根目录存在 `pnpm-workspace.yaml`（用于 pnpm v10+ 的 `allowBuilds` 配置），但该文件没有 `packages` 字段。Docker 构建时 `COPY . .` 将其复制进容器，pnpm 读取到后认为这是个 monorepo 工作区，`pnpm build` 尝试在所有包中运行 `build` 脚本，但 `packages` 为空，报错。

**修复**（两件事都要做）：

1. **`.dockerignore` 排除 workspace 文件**，不让它进入 Docker 构建上下文：
```
# pnpm workspace（避免 docker 内被误识别为 monorepo）
pnpm-workspace.yaml
```

2. **Dockerfile 中用 `npx next build` 替代 `pnpm build`**，直接调用 Next.js 构建，绕过 pnpm workspace 机制：
```dockerfile
# 错误（受 workspace 影响）
RUN pnpm build

# 正确（直调 Next.js）
RUN npx next build
```

---

### 🕳️ 坑位 #3：GitHub HTTPS 推送被本地网络拦截（2026-05-22）

**现象**：`git push` 报 `Failed to connect to github.com port 443: Could not connect to server`

**根因**：部分网络环境（店铺/公司网络）封锁 GitHub 443 端口。

**方案**：
1. 开启 VPN 后推送（已验证可行）
2. 或用 SSH 协议替代 HTTPS（需先配置 SSH Key 并关联 GitHub 账号）
3. 断开 VPN 后需重新连接才能推送

---

## 附录 C：快速命令速查

```bash
# === 构建 ===
docker build -t crpi-xxx/jadeerp/jadeerp:sha-$(git rev-parse --short HEAD) .
docker push crpi-xxx/jadeerp/jadeerp:sha-$(git rev-parse --short HEAD)

# === 部署 ===
docker compose pull                          # 拉取最新镜像
docker compose up -d                         # 启动（后台运行）
docker compose restart jade-inventory        # 重启容器
docker compose stop jade-inventory           # 停止容器
docker compose down                          # 停止并删除容器

# === 监控 ===
docker compose ps                            # 查看状态
docker compose logs -f jade-inventory        # 实时日志
docker stats jade-inventory --no-stream      # 资源占用
docker compose exec jade-inventory sh        # 进入容器

# === 验证 ===
sh scripts/nas-healthcheck.sh http://127.0.0.1:5000     # 健康检查
sh scripts/nas-healthcheck.sh https://壳域名             # 外网检查

# === 回滚 ===
sh scripts/nas-rollback.sh crpi-xxx/jadeerp/jadeerp:sha-<之前tag>

# === 备份 ===
docker compose exec jade-inventory cp /app/data/db/custom.db /app/backups/custom_$(date +%Y%m%d_%H%M%S).db
```
