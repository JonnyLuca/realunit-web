#!/usr/bin/env bash
#
# Run the Playwright suite inside the pinned container so screenshots render
# against the exact browsers the committed baselines were generated with.
#
#   bash scripts/e2e-docker.sh                     # run + compare + visual gate
#   bash scripts/e2e-docker.sh --update-snapshots  # (re)generate the baselines
#
# node_modules is kept in an anonymous volume so the in-container Linux install
# never overwrites the host's modules. Baselines and the report are written
# through the bind mount and persist on the host.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(node -p "try { require('@playwright/test/package.json').version } catch (e) { require('./package.json').devDependencies['@playwright/test'] }")"
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"

UPDATE=""
RUN_VISUAL_GATE=1
if [ "${1:-}" = "--update-snapshots" ]; then
  UPDATE="--update-snapshots"
  RUN_VISUAL_GATE=0
fi

echo "Playwright container: ${IMAGE}"

docker run --rm --init \
  -v "$PWD":/work \
  -v /work/node_modules \
  -w /work \
  -e CI=1 \
  "$IMAGE" \
  bash -c "
    set -e
    npm ci --no-audit --no-fund || npm ci --no-audit --no-fund
    npx playwright test ${UPDATE}
    if [ ${RUN_VISUAL_GATE} -eq 1 ]; then node scripts/check-visual.mjs; fi
  "
