@echo off
chcp 65001 >nul
set "SCRIPT=%~dp0cai_dat_vao_web.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -RepoPath "%~1"
echo.
pause
