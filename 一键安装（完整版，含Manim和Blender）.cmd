@echo off
chcp 65001 >nul
echo code-video 完整安装：额外安装 Manim（Python）与 Blender，耗时较长
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Full %*
echo.
pause
