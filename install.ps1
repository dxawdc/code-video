<#
  code-video 一键安装（Windows）
  - 检查/安装 Node.js 与 ffmpeg（winget），检查 Chrome/Edge
  - 把运行时（film 命令行 + 模板 + 库）装到 $Runtime（默认 ~/.code-video），安装 JS 依赖
  - film 加入用户 PATH，写入环境变量 CODE_VIDEO_HOME
  - 把技能复制到 Claude Code / Codex / WorkBuddy 等工具的技能目录
  用法：
    powershell -ExecutionPolicy Bypass -File install.ps1                 # 标准安装（含 edge-tts 旁白）
    powershell -ExecutionPolicy Bypass -File install.ps1 -Full           # 再加 Manim + Blender
    powershell -ExecutionPolicy Bypass -File install.ps1 -Targets claude,codex
    powershell -ExecutionPolicy Bypass -File install.ps1 -Targets "D:\某工具\skills"
#>
param(
  [string[]]$Targets = @('auto'),
  [switch]$Lite,
  [switch]$Full,
  [switch]$Python,
  [switch]$Blender,
  [switch]$NoTts,
  [switch]$NoPath,
  [switch]$NoSystem,
  [switch]$Demo,
  [string]$Runtime = (Join-Path $HOME '.code-video')
)
$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillName = 'code-video'
function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m) { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!] $m" -ForegroundColor Yellow }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Has($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function WingetInstall($id) {
  if (-not (Has 'winget')) { return $false }
  Write-Host "  winget install $id ..."
  winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
  Refresh-Path
  return $true
}

Write-Host "code-video 安装器" -ForegroundColor White
Write-Host "运行时目录：$Runtime"

# ── 1. 系统依赖 ──
Step '检查系统依赖'
if (-not (Has 'node')) {
  if ($NoSystem) { throw '没有 Node.js，请先安装 https://nodejs.org （LTS 版）' }
  WingetInstall 'OpenJS.NodeJS.LTS' | Out-Null
  if (-not (Has 'node')) { throw '自动安装 Node.js 失败，请手动安装 https://nodejs.org 后重新运行' }
}
$nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 18) { throw "Node.js 版本太低（$(node -v)），需要 18 以上" }
Ok "Node.js $(node -v)$(if ($nodeMajor -lt 22) { '（HyperFrames 需要 22+，其他不受影响）' })"

if (-not (Has 'ffmpeg')) {
  if ($NoSystem) { throw '没有 ffmpeg，请先安装（winget install Gyan.FFmpeg）' }
  WingetInstall 'Gyan.FFmpeg' | Out-Null
  if (-not (Has 'ffmpeg')) { throw '自动安装 ffmpeg 失败，请手动安装 https://www.gyan.dev/ffmpeg/builds/ 并加入 PATH' }
}
Ok 'ffmpeg 已就绪'

$browsers = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
$browser = $browsers | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($browser) { Ok "浏览器：$browser" } else { Warn '没找到 Chrome/Edge：浏览器类技术栈需要它（可设置环境变量 CHROME_PATH）' }

# ── 2. 运行时 ──
Step "安装运行时到 $Runtime"
$src = Join-Path $Here 'scripts\kit'
if (-not (Test-Path $src)) { throw "安装包不完整：缺少 $src" }
New-Item -ItemType Directory -Force $Runtime | Out-Null
foreach ($d in 'bin', 'lib', 'templates', 'py') {
  $dst = Join-Path $Runtime $d
  if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
  Copy-Item -Recurse -Force (Join-Path $src $d) $dst
}
foreach ($f in 'package.json', 'KIT.md') { if (Test-Path (Join-Path $src $f)) { Copy-Item -Force (Join-Path $src $f) $Runtime } }
Set-Content -Encoding ascii -Path (Join-Path $Runtime 'bin\film.cmd') -Value "@echo off`r`nnode `"%~dp0film.js`" %*"
Ok '文件已复制'

Step '安装 JS 依赖（首次约 1~3 分钟）'
$setupArgs = @()
if ($Lite) { $setupArgs += '--lite' }
if ($Full -or $Python) { $setupArgs += '--python' } elseif (-not $NoTts) { $setupArgs += '--tts' }
if ($Full -or $Blender) { $setupArgs += '--blender' }
node (Join-Path $Runtime 'bin\film.js') setup @setupArgs
if ($LASTEXITCODE -ne 0) { Warn 'film setup 有错误，见上方输出（基础功能可能仍可用）' }

# ── 3. PATH 与环境变量 ──
Step '配置命令行'
$env:CODE_VIDEO_HOME = $Runtime
if (-not $NoPath) {
  [Environment]::SetEnvironmentVariable('CODE_VIDEO_HOME', $Runtime, 'User')
  $binDir = Join-Path $Runtime 'bin'
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not ($userPath -split ';' | Where-Object { $_ -eq $binDir })) {
    [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $binDir), 'User')
    Ok "已把 $binDir 加入用户 PATH（新开的终端生效）"
  } else { Ok 'PATH 已包含 film' }
  $env:Path += ";$binDir"
}

# ── 4. 安装技能到各工具 ──
Step '安装技能'
$known = [ordered]@{
  claude    = @{ home = (Join-Path $HOME '.claude'); dir = (Join-Path $HOME '.claude\skills') }
  codex     = @{ home = (Join-Path $HOME '.codex'); dir = (Join-Path $HOME '.codex\skills') }
  workbuddy = @{ home = (Join-Path $HOME '.workbuddy'); dir = (Join-Path $HOME '.workbuddy\skills') }
  workbuddy2 = @{ home = (Join-Path $env:APPDATA 'WorkBuddy'); dir = (Join-Path $env:APPDATA 'WorkBuddy\skills') }
  agents    = @{ home = (Join-Path $HOME '.agents'); dir = (Join-Path $HOME '.agents\skills') }
}
$dirs = @()
# 通过 -File 调用时逗号分隔的列表会变成一个字符串，这里统一拆开
$Targets = @($Targets | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($t in $Targets) {
  if ($t -eq 'auto') {
    foreach ($k in $known.Keys) { if (Test-Path $known[$k].home) { $dirs += $known[$k].dir } }
    if (-not $dirs.Count) { $dirs += $known.claude.dir, $known.codex.dir, $known.workbuddy.dir }
  } elseif ($known.Contains($t)) { $dirs += $known[$t].dir }
  elseif ($t -eq 'all') { $dirs += $known.claude.dir, $known.codex.dir, $known.workbuddy.dir }
  else { $dirs += $t }
}
foreach ($d in ($dirs | Select-Object -Unique)) {
  $dst = Join-Path $d $SkillName
  New-Item -ItemType Directory -Force $d | Out-Null
  if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
  New-Item -ItemType Directory -Force $dst | Out-Null
  # 只复制技能本身；仓库专用的东西（.git、配图、引导脚本）不进技能目录
  $skip = @('node_modules', '.git', '.github', 'assets', 'get.ps1', 'get.sh', '.gitignore', '.gitattributes')
  Get-ChildItem $Here -Force | Where-Object { $_.Name -notin $skip } | ForEach-Object { Copy-Item -Recurse -Force $_.FullName $dst }
  Ok "技能 → $dst"
}

# ── 5. 体检 ──
Step '体检'
node (Join-Path $Runtime 'bin\film.js') doctor

if ($Demo) {
  Step '生成演示片（约 5~10 分钟）'
  $demoDir = Join-Path $HOME 'code-video-demo'
  node (Join-Path $Runtime 'bin\film.js') demo $demoDir --quick
  Ok "演示片在 $demoDir"
}

Write-Host "`n安装完成。" -ForegroundColor Green
Write-Host @"
接下来：
  1. 重启你的 AI 工具（Claude Code / Codex / WorkBuddy），让它读到 code-video 技能
  2. 对它说：用 code-video 技能，做一个 60 秒的科普短片，主题是……
  3. 也可以自己用：新开终端运行  film doctor  /  film demo  /  film new 我的片 --type three
卸载：powershell -ExecutionPolicy Bypass -File "$Here\uninstall.ps1"
"@
