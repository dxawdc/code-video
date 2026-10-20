<#
  code-video 卸载（Windows）：删除各工具里的技能目录、运行时、PATH 条目与环境变量。
  powershell -ExecutionPolicy Bypass -File uninstall.ps1 [-KeepRuntime]
#>
param([switch]$KeepRuntime, [string]$Runtime = $(if ($env:CODE_VIDEO_HOME) { $env:CODE_VIDEO_HOME } else { Join-Path $HOME '.code-video' }))
$ErrorActionPreference = 'Continue'
$targets = @(
  (Join-Path $HOME '.claude\skills\code-video'), (Join-Path $HOME '.codex\skills\code-video'),
  (Join-Path $HOME '.workbuddy\skills\code-video'), (Join-Path $env:APPDATA 'WorkBuddy\skills\code-video'),
  (Join-Path $HOME '.agents\skills\code-video')
)
foreach ($t in $targets) { if (Test-Path $t) { Remove-Item -Recurse -Force $t; Write-Host "已删除 $t" } }
if (-not $KeepRuntime -and (Test-Path $Runtime)) { Remove-Item -Recurse -Force $Runtime; Write-Host "已删除运行时 $Runtime" }
$binDir = Join-Path $Runtime 'bin'
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$newPath = ($userPath -split ';' | Where-Object { $_ -and $_ -ne $binDir }) -join ';'
if ($newPath -ne $userPath) { [Environment]::SetEnvironmentVariable('Path', $newPath, 'User'); Write-Host '已从 PATH 移除 film' }
[Environment]::SetEnvironmentVariable('CODE_VIDEO_HOME', $null, 'User')
Write-Host '卸载完成（Node、ffmpeg、Python、Blender 等系统软件未动）。'
