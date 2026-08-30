#!/usr/bin/env bash
set -euo pipefail

: "${GAME_GPU_EXPECTED_BUS:?GAME_GPU_EXPECTED_BUS is required}"
: "${GAME_GPU_EXPECTED_UUID:?GAME_GPU_EXPECTED_UUID is required}"

identity=$(
  nvidia-smi --id=1 --query-gpu=pci.bus_id,uuid --format=csv,noheader,nounits |
    awk -F ', *' 'NR == 1 { print tolower($1), $2 }'
)
read -r bus uuid <<<"$identity"

[[ $bus == "${GAME_GPU_EXPECTED_BUS,,}" && $uuid == "$GAME_GPU_EXPECTED_UUID" ]] || {
  echo 'Physical GPU 1 identity does not match the reviewed game runtime.' >&2
  exit 1
}
