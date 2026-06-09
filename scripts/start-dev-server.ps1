<#
.SYNOPSIS
  新翡翠ERP 持久测试服务器
  端口：9677 | 热更新：开启 | 崩溃自动拉起

.DESCRIPTION
  本脚本用于：
  1. 确保项目环境就绪（Node.js、pnpm、corepack）
  2. 启动 Next.js 开发服务器（端口 9677，HMR 热更新）
  3. 无限自动重启：进程崩溃后等待 5 秒自动拉起
  4. 日志记录：输出保存到 logs/dev-server.log

  配合 Windows 计划任务实现「开机自启动」：
  - 触发器：用户登录时
  - 操作：powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-dev-server.ps1"
  - 运行身份：当前用户
#>

$ErrorActionPreference = 'Stop'

# ── 配置 ──
$ProjectDir    = Resolve-Path "$PSScriptRoot\.."
$Port          = 9677
$LogDir        = "$ProjectDir\logs"
$LogFile       = "$LogDir\dev-server.log"
$NodeVersion   = '22.22.1'
$PnpmVersion   = '9.15.4'

# ── 确保日志目录存在 ──
if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$timestamp] $Message"
  Write-Host $line
  Add-Content -Path $LogFile -Value $line
}

Write-Log "═══════════════════════════════════════"
Write-Log "  新翡翠ERP 持久测试服务器"
Write-Log "  项目: $ProjectDir"
Write-Log "  端口: $Port"
Write-Log "═══════════════════════════════════════"

# ── 1. 切换到项目目录 ──
Set-Location $ProjectDir

# ── 2. 检查端口 ──
$existingProcess = netstat -ano | Select-String ":$Port\s" | Select-String "LISTEN"
if ($existingProcess) {
  Write-Log "⚠️ 端口 $Port 已被占用"
  $existingPid = ($existingProcess -split '\s+')[-1]
  $processName = (Get-Process -Id $existingPid -ErrorAction SilentlyContinue).ProcessName
  if ($processName -match 'node|Next\.js') {
    Write-Log "✅ 已有开发服务器运行中 (PID: $existingPid)"
    exit 0
  } else {
    Write-Log "⚠️ 端口被非 Node 进程占用 ($processName, PID: $existingPid)"
    exit 1
  }
}

# ── 3. 检查 Node.js ──
try {
  $currentNode = node -v
  Write-Log "Node.js 版本: $currentNode"
} catch {
  Write-Log "❌ Node.js 未找到"
  exit 1
}

# ── 4. 确保 pnpm ──
try {
  corepack enable
  corepack prepare "pnpm@$PnpmVersion" --activate | Out-Null
  $currentPnpm = pnpm -v
  Write-Log "pnpm 版本: $currentPnpm"
} catch {
  Write-Log "⚠️ corepack/pnpm 检查失败: $_"
}

# ── 5. 依赖检查 ──
if (-not (Test-Path "$ProjectDir\node_modules")) {
  Write-Log "📦 安装依赖..."
  try {
    pnpm install --frozen-lockfile | Out-Null
  } catch {
    pnpm install | Out-Null
  }
}

# ── 6. 清理过大的 Turbopack 缓存 ──
$devCachePath = "$ProjectDir\.next\dev"
if (Test-Path $devCachePath) {
  $cacheSize = (Get-ChildItem -Path $devCachePath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  $cacheSizeMB = [math]::Round($cacheSize / 1MB, 1)
  if ($cacheSizeMB -gt 300) {
    Write-Log "🧹 清理 Turbopack 缓存 (${cacheSizeMB}MB)..."
    Remove-Item -Path $devCachePath -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    Write-Log "📦 Turbopack 缓存 ${cacheSizeMB}MB"
  }
}

# ── 7. 启动（无限自动重启循环）──
$restartCount = 0
while ($true) {
  Write-Log "🚀 启动 Next.js 开发服务器 (端口 $Port)"
  Write-Log "   URL: http://localhost:$Port"

  $pinfo = New-Object System.Diagnostics.ProcessStartInfo
  $pinfo.FileName = 'npx.cmd'
  $pinfo.Arguments = "next dev -p $Port"
  $pinfo.WorkingDirectory = $ProjectDir
  $pinfo.UseShellExecute = $false
  $pinfo.CreateNoWindow = $true
  $pinfo.EnvironmentVariables['NODE_ENV'] = 'development'

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $pinfo

  try {
    $proc.Start() | Out-Null
    $pid = $proc.Id
    Write-Log "✅ 已启动 (PID: $pid)"

    # 等待退出（不重定向流，避免 PowerShell 5 死锁）
    $proc.WaitForExit()
    $exitCode = $proc.ExitCode
    Write-Log "⚠️ 进程退出 (ExitCode: $exitCode)"

    if ($exitCode -eq 0) {
      Write-Log "⏳ 正常关闭，5 秒后重启..."
    } else {
      $restartCount++
      Write-Log "⏳ 异常退出，5 秒后自动拉起 (已重启 $restartCount 次)..."
    }
  } catch {
    Write-Log "❌ 启动失败: $_"
    Write-Log "⏳ 5 秒后重试..."
  } finally {
    # 确保进程已清理
    if ($proc -and !$proc.HasExited) {
      $proc.Kill()
    }
    $proc.Dispose()
  }

  Start-Sleep -Seconds 5
}
