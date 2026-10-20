# code-video remote installer for Windows.
#   irm https://raw.githubusercontent.com/dxawdc/code-video/main/get.ps1 | iex
# Downloads the latest main branch, then runs install.ps1 (Node.js / ffmpeg / runtime / skills).
# Set $env:CODE_VIDEO_ARGS before running to pass options, e.g.  $env:CODE_VIDEO_ARGS = '-Full'
$ErrorActionPreference = 'Stop'
$repo = 'dxawdc/code-video'
$tmp = Join-Path $env:TEMP ("code-video-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $tmp | Out-Null
$zip = Join-Path $tmp 'src.zip'
Write-Host "Downloading $repo ..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest "https://github.com/$repo/archive/refs/heads/main.zip" -OutFile $zip -UseBasicParsing
Expand-Archive $zip $tmp -Force
$dir = Get-ChildItem $tmp -Directory | Select-Object -First 1
$extra = @()
if ($env:CODE_VIDEO_ARGS) { $extra = $env:CODE_VIDEO_ARGS -split ' ' | Where-Object { $_ } }
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dir.FullName 'install.ps1') @extra
