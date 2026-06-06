<# 
.SYNOPSIS
  Claude Code EEXIST auto-fix script
.DESCRIPTION
  Cleans up stale session directories under OneDrive/claude that
  cause "EEXIST: file already exists, mkdir tasks" errors.
  Root cause: fs.mkdirSync() called without { recursive: true }
  GitHub:    https://github.com/anthropics/claude-code/issues/56191
  Fixed in:  v2.1.163 (session-env), tasks dir may still be affected
.PARAMETER Watch
  Run in continuous monitoring mode
.PARAMETER Interval
  Monitoring interval in seconds (default: 30)
.EXAMPLE
  .\fix-claude-eexist.ps1
  .\fix-claude-eexist.ps1 -Watch -Interval 60
#>
param(
  [switch]$Watch,
  [int]$Interval = 30
)

$ErrorActionPreference = "Continue"

# Claude Code encodes project path like D:\02\... -> D--02---...
$encodedProject = "D--02---ERP-newjade"

# Possible state directory locations
$stateDirs = @(
  "D:\onedrive\claude\$encodedProject"
)

function Clear-ClaudeSessionDirs {
  $cleaned = 0
  foreach ($base in $stateDirs) {
    if (-not (Test-Path $base)) { continue }
    
    Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $tasksDir = Join-Path $_.FullName "tasks"
      if (Test-Path $tasksDir) {
        Write-Host "[CLEAN] $tasksDir" -ForegroundColor Yellow
        Remove-Item -Recurse -Force $tasksDir -ErrorAction SilentlyContinue
        $cleaned++
      }
      
      $sessionEnvDir = Join-Path $_.FullName "session-env"
      if (Test-Path $sessionEnvDir) {
        Write-Host "[CLEAN] $sessionEnvDir" -ForegroundColor Yellow
        Remove-Item -Recurse -Force $sessionEnvDir -ErrorAction SilentlyContinue
        $cleaned++
      }
    }
  }
  
  if ($cleaned -eq 0) {
    Write-Host "[OK] No stale dirs found" -ForegroundColor Green
  } else {
    Write-Host "[DONE] Cleaned $cleaned directories" -ForegroundColor Green
  }
  return $cleaned
}

function Watch-ClaudeSession {
  Write-Host "[WATCH] Monitoring every ${Interval}s, press Ctrl+C to stop" -ForegroundColor Cyan
  while ($true) {
    $count = Clear-ClaudeSessionDirs
    if ($count -gt 0) {
      Write-Host "[WATCH] $(Get-Date -Format 'HH:mm:ss') cleaned $count dir(s)" -ForegroundColor Magenta
    }
    Start-Sleep -Seconds $Interval
  }
}

# === Main ===
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Claude Code EEXIST Fix Tool" -ForegroundColor Cyan
Write-Host " Project: newjade" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if ($Watch) {
  Watch-ClaudeSession
} else {
  Clear-ClaudeSessionDirs
}
