#!/usr/bin/env bash
# Screenshot helper — Chrome headless CLI.
# Uso: ./scripts/shot.sh <url> <out.png> [virtual-time-budget-ms] [WxH]
set -euo pipefail
URL="$1"
OUT="$2"
BUDGET="${3:-9000}"
SIZE="${4:-1366,768}"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
timeout 220 "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size="$SIZE" \
  --virtual-time-budget="$BUDGET" --no-first-run --no-default-browser-check --user-data-dir="$TEMP/chrome-shot-profile" \
  --screenshot="$OUT" \
  "$URL" >/dev/null 2>&1 || true
[ -f "$OUT" ] && echo "OK $OUT" || { echo "FAIL $OUT"; exit 1; }
