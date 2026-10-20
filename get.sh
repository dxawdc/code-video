#!/usr/bin/env bash
# code-video remote installer for macOS / Linux.
#   curl -fsSL https://raw.githubusercontent.com/dxawdc/code-video/main/get.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/dxawdc/code-video/main/get.sh | bash -s -- --full
set -euo pipefail
REPO="dxawdc/code-video"
TMP="$(mktemp -d)"
echo "Downloading $REPO ..."
if command -v git >/dev/null 2>&1; then
  git clone --depth 1 "https://github.com/$REPO.git" "$TMP/code-video" >/dev/null 2>&1
else
  curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.tar.gz" | tar -xz -C "$TMP"
  mv "$TMP"/code-video-main "$TMP/code-video"
fi
bash "$TMP/code-video/install.sh" "$@"
