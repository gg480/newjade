# Jade ERP — NAS 运维脚本

## 一键更新（推荐）

```bash
# 更新到 latest
sh scripts/nas-update.sh

# 更新到指定版本（GitHub Actions 构建的 sha 标签）
sh scripts/nas-update.sh --tag=sha-abc123

# 跳过数据库备份（不推荐）
sh scripts/nas-update.sh --no-backup
```

## 自动更新（Watchtower）

Watchtower 已集成在 `docker-compose.yml` 中，默认每 6 小时检查一次镜像更新。

```bash
# 启动 Watchtower（已包含在 docker compose up -d 中）
docker compose up -d watchtower

# 查看 Watchtower 日志
docker compose logs -f watchtower

# 手动触发一次检查
docker exec jade-watchtower watchtower --run-once

# 临时禁用自动更新
docker compose stop watchtower
```

## 定时任务（NAS 计划任务）

如果不想用 Watchtower，可以在 NAS 管理界面设置计划任务：

```
# 每天凌晨 3 点检查更新
0 3 * * * cd /path/to/jade-erp && sh scripts/nas-update.sh >> /var/log/jade-update.log 2>&1
```

## 数据库备份

```bash
# 手动备份
sh scripts/nas-backup.sh

# 定时备份（NAS 计划任务，每天凌晨 2 点）
0 2 * * * cd /path/to/jade-erp && sh scripts/nas-backup.sh
```

## 健康检查

```bash
# 快速检查
sh scripts/nas-healthcheck.sh

# 指定地址
sh scripts/nas-healthcheck.sh http://192.168.1.100:5000
```

## 回滚

```bash
# 方式 1：通过 nas-update.sh 自动回滚（更新失败时自动执行）
# 方式 2：手动指定旧版本
sh scripts/nas-update.sh --tag=sha-旧版本

# 方式 3：从备份恢复数据库
# 先停止服务，恢复数据库，再启动
docker compose stop
cp backups/custom_20260101_120000.db db/custom.db
docker compose up -d
```

## 完整部署流程

```bash
# 首次部署
cp .env.nas.example .env
# 编辑 .env 修改配置
docker compose up -d

# 日常更新（Watchtower 自动处理，或手动执行）
sh scripts/nas-update.sh
```
