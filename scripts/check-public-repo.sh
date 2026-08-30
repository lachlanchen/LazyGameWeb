#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
cd "$repo_root"

node --check apps/portal/bin/game-portal.mjs
while IFS= read -r source_file; do
  node --check "$source_file"
done < <(find apps/portal/src apps/portal/test -type f -name '*.mjs' -print | sort)

bash -n scripts/*.sh deploy/game.lazying.art/scripts/*.sh
npm test

for forbidden in node_modules .local .cache data runtime credentials secrets; do
  if find . -path './.git' -prune -o -type d -name "$forbidden" -print -quit | grep -q .; then
    printf 'forbidden public directory: %s\n' "$forbidden" >&2
    exit 1
  fi
done

if rg -n --hidden \
  --glob '!.git/**' \
  --glob '!scripts/check-public-repo.sh' \
  -e 'BEGIN [A-Z ]*PRIVATE KEY' \
  -e 'github_pat_[A-Za-z0-9_]+' \
  -e 'gh[pousr]_[A-Za-z0-9]+' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e 'Bearer [A-Za-z0-9._~-]{32,}' .; then
  echo 'possible credential material found' >&2
  exit 1
fi

git diff --check
printf 'public repository checks passed\n'
