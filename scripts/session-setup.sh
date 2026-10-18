#!/usr/bin/env bash
# Prepares a fresh cloud session: node deps, Remotion's headless browser and
# faster-whisper (local word alignment). Idempotent and quiet when ready.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules/remotion ] || npm ci --silent
npx remotion browser ensure >/dev/null 2>&1 || true
python3 -c "import faster_whisper" 2>/dev/null || python3 -m pip install --quiet faster-whisper
mkdir -p data/cache
echo "social-media-maker ready"
