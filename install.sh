#!/usr/bin/env bash
# code-video 一键安装（macOS / Linux）
#   bash install.sh                     标准安装（含 edge-tts 旁白）
#   bash install.sh --full              再加 Manim + Blender
#   bash install.sh --targets "claude codex"  或  --targets "$HOME/.某工具/skills"
#   bash install.sh --demo              装完生成演示片
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME="${CODE_VIDEO_HOME:-$HOME/.code-video}"
TARGETS="auto"; LITE=""; FULL=""; DEMO=""; NOTTS=""; NOPATH=""
while [ $# -gt 0 ]; do
  case "$1" in
    --targets) TARGETS="$2"; shift ;;
    --runtime) RUNTIME="$2"; shift ;;
    --lite) LITE=1 ;; --full) FULL=1 ;; --demo) DEMO=1 ;; --no-tts) NOTTS=1 ;; --no-path) NOPATH=1 ;;
    *) echo "未知参数 $1"; exit 1 ;;
  esac; shift
done
step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
ok() { printf '  \033[32m[OK]\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m[!]\033[0m %s\n' "$1"; }
has() { command -v "$1" >/dev/null 2>&1; }

echo "code-video 安装器  运行时目录：$RUNTIME"

step "检查系统依赖"
if ! has node; then
  if has brew; then brew install node; else echo "请先安装 Node.js 18+（https://nodejs.org）"; exit 1; fi
fi
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_MAJOR" -ge 18 ] || { echo "Node.js 太旧（$(node -v)），需要 18+"; exit 1; }
ok "Node.js $(node -v)"
if ! has ffmpeg; then
  if has brew; then brew install ffmpeg
  elif has apt-get; then sudo apt-get update && sudo apt-get install -y ffmpeg
  else echo "请先安装 ffmpeg"; exit 1; fi
fi
ok "ffmpeg 已就绪"
if [ -d "/Applications/Google Chrome.app" ] || has google-chrome || has chromium || has chromium-browser; then ok "找到 Chrome/Chromium"
else warn "没找到 Chrome/Chromium：浏览器类技术栈需要它（或设置 CHROME_PATH）"; fi
if [ "$(uname)" = "Linux" ] && ! fc-list :lang=zh >/dev/null 2>&1; then warn "没有中文字体：sudo apt-get install fonts-noto-cjk"; fi

step "安装运行时到 $RUNTIME"
SRC="$HERE/scripts/kit"
[ -d "$SRC" ] || { echo "安装包不完整：缺少 $SRC"; exit 1; }
mkdir -p "$RUNTIME"
for d in bin lib templates py; do rm -rf "$RUNTIME/$d"; cp -R "$SRC/$d" "$RUNTIME/$d"; done
for f in package.json KIT.md; do [ -f "$SRC/$f" ] && cp "$SRC/$f" "$RUNTIME/"; done
cat > "$RUNTIME/bin/film" <<'EOF'
#!/usr/bin/env bash
exec node "$(dirname "$0")/film.js" "$@"
EOF
chmod +x "$RUNTIME/bin/film" "$RUNTIME/bin/film.js"
ok "文件已复制"

step "安装 JS 依赖（首次约 1~3 分钟）"
ARGS=()
[ -n "$LITE" ] && ARGS+=(--lite)
if [ -n "$FULL" ]; then ARGS+=(--python --blender); elif [ -z "$NOTTS" ]; then ARGS+=(--tts); fi
node "$RUNTIME/bin/film.js" setup "${ARGS[@]}" || warn "film setup 有错误，见上方输出"

step "配置命令行"
if [ -z "$NOPATH" ]; then
  LINE="export PATH=\"$RUNTIME/bin:\$PATH\"; export CODE_VIDEO_HOME=\"$RUNTIME\""
  for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
    [ -f "$rc" ] || [ "$rc" = "$HOME/.zshrc" -a "$(basename "${SHELL:-}")" = "zsh" ] || continue
    grep -qF "$RUNTIME/bin" "$rc" 2>/dev/null || { echo "$LINE" >> "$rc"; ok "已写入 $rc（新开终端生效）"; }
  done
fi
export PATH="$RUNTIME/bin:$PATH" CODE_VIDEO_HOME="$RUNTIME"

step "安装技能"
DIRS=()
for t in $TARGETS; do
  case "$t" in
    auto)
      for h in .claude .codex .workbuddy .agents; do [ -d "$HOME/$h" ] && DIRS+=("$HOME/$h/skills"); done
      [ ${#DIRS[@]} -eq 0 ] && DIRS+=("$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.workbuddy/skills") ;;
    all) DIRS+=("$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.workbuddy/skills") ;;
    claude|codex|workbuddy|agents) DIRS+=("$HOME/.$t/skills") ;;
    *) DIRS+=("$t") ;;
  esac
done
for d in "${DIRS[@]}"; do
  mkdir -p "$d"; rm -rf "$d/code-video"; mkdir -p "$d/code-video"
  # 只复制技能本身；仓库专用的东西（.git、配图、引导脚本）不进技能目录
  for item in "$HERE"/* "$HERE"/.[!.]*; do
    [ -e "$item" ] || continue
    case "$(basename "$item")" in .git|.github|assets|get.ps1|get.sh|.gitignore|.gitattributes|node_modules) continue ;; esac
    cp -R "$item" "$d/code-video/"
  done
  ok "技能 → $d/code-video"
done

step "体检"
node "$RUNTIME/bin/film.js" doctor || true

if [ -n "$DEMO" ]; then
  step "生成演示片"
  node "$RUNTIME/bin/film.js" demo "$HOME/code-video-demo" --quick
fi

cat <<EOF

安装完成。
  1. 重启你的 AI 工具（Claude Code / Codex / WorkBuddy），让它读到 code-video 技能
  2. 对它说：用 code-video 技能，做一个 60 秒的科普短片，主题是……
  3. 也可以自己用（新开终端）：film doctor / film demo / film new 我的片 --type three
卸载：rm -rf "$RUNTIME" ~/.claude/skills/code-video ~/.codex/skills/code-video ~/.workbuddy/skills/code-video
EOF
