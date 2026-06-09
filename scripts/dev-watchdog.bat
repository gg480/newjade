@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ============================================
echo   新翡翠ERP 持久测试服务器 (Watchdog)
echo   端口: 9677 ^| 崩溃自动拉起
echo ============================================

:restart
echo [%date% %time%] 启动 Next.js 开发服务器...
npx next dev -p 9677
echo [%date% %time%] 服务器已退出 (ExitCode: %ERRORLEVEL%)
echo [%date% %time%] 5 秒后自动重启...
timeout /t 5 /nobreak >nul
goto restart
