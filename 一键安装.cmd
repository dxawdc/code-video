@echo off
chcp 65001 >nul
echo code-video 一键安装：film 命令行 + 九种技术栈 + 技能（Claude Code / Codex / WorkBuddy）
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
