#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

OUTPUT_PATH="${REPO_ROOT}/dist.zip"
CORES_CSV=""
INCLUDE_ALL_CORES=true

usage() {
  cat <<'USAGE'
Usage:
  scripts/package-dist.sh [--output <zip-path>] [--cores <comma-list>] [--all-cores] [--list-cores]

Options:
  --output <zip-path>   Output zip path. Defaults to ./dist.zip at repo root.
  --cores <list>        Comma-separated core IDs to include (for example: fceumm,snes9x,melonds).
  --all-cores           Include every installed core in data/cores.
  --list-cores          Print installed core IDs and exit.
  --help                Show this help.

Notes:
  - This script packages only publish-required app files plus selected core assets.
  - .git, ignored files, and unrelated project files are excluded by design.
  - With no flags, this script builds ./dist.zip with all bundled cores.
USAGE
}

list_installed_cores() {
  if [[ ! -d "${REPO_ROOT}/data/cores" ]]; then
    return 0
  fi
  find "${REPO_ROOT}/data/cores" -maxdepth 1 -type f -name '*-wasm.data' ! -name '*-legacy-wasm.data' ! -name '*-thread-wasm.data' -printf '%f\n' \
    | sed 's/-wasm\.data$//' \
    | sort -u
}

contains_core() {
  local needle="$1"
  shift || true
  local item
  for item in "$@"; do
    if [[ "${item}" == "${needle}" ]]; then
      return 0
    fi
  done
  return 1
}

copy_file() {
  local rel="$1"
  local src="${REPO_ROOT}/${rel}"
  local dst="${STAGE_DIR}/${rel}"
  if [[ ! -f "${src}" ]]; then
    echo "Missing required file: ${rel}" >&2
    exit 1
  fi
  mkdir -p "$(dirname -- "${dst}")"
  cp -f -- "${src}" "${dst}"
}

copy_file_if_exists() {
  local rel="$1"
  local src="${REPO_ROOT}/${rel}"
  local dst="${STAGE_DIR}/${rel}"
  if [[ ! -f "${src}" ]]; then
    return 0
  fi
  mkdir -p "$(dirname -- "${dst}")"
  cp -f -- "${src}" "${dst}"
}

copy_dir() {
  local rel="$1"
  local src="${REPO_ROOT}/${rel}"
  local dst="${STAGE_DIR}/${rel}"
  if [[ ! -d "${src}" ]]; then
    echo "Missing required directory: ${rel}" >&2
    exit 1
  fi
  mkdir -p "$(dirname -- "${dst}")"
  cp -a -- "${src}" "${dst}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      [[ $# -ge 2 ]] || { echo "Missing value for --output" >&2; exit 1; }
      OUTPUT_PATH="$2"
      shift 2
      ;;
    --cores)
      [[ $# -ge 2 ]] || { echo "Missing value for --cores" >&2; exit 1; }
      CORES_CSV="$2"
      INCLUDE_ALL_CORES=false
      shift 2
      ;;
    --all-cores)
      INCLUDE_ALL_CORES=true
      shift
      ;;
    --list-cores)
      list_installed_cores
      exit 0
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "${OUTPUT_PATH}" != /* ]]; then
  OUTPUT_PATH="${REPO_ROOT}/${OUTPUT_PATH}"
fi

declare -a INSTALLED_CORES=()
while IFS= read -r core; do
  [[ -n "${core}" ]] && INSTALLED_CORES+=("${core}")
done < <(list_installed_cores)

declare -a SELECTED_CORES=()
if [[ -n "${CORES_CSV}" ]]; then
  IFS=',' read -r -a raw_cores <<< "${CORES_CSV}"
  for core in "${raw_cores[@]}"; do
    core="$(echo "${core}" | xargs)"
    [[ -n "${core}" ]] && SELECTED_CORES+=("${core}")
  done
elif [[ "${INCLUDE_ALL_CORES}" == true ]]; then
  SELECTED_CORES=("${INSTALLED_CORES[@]}")
fi

for core in "${SELECTED_CORES[@]}"; do
  if ! contains_core "${core}" "${INSTALLED_CORES[@]}"; then
    echo "Selected core is not installed: ${core}" >&2
    echo "Installed cores:" >&2
    printf '  - %s\n' "${INSTALLED_CORES[@]}" >&2
    exit 1
  fi
done

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf -- "${STAGE_DIR}"' EXIT

# Core application files.
copy_file "index.html"
copy_file "player.html"
copy_file "qortium-qortal-bridge.js"
copy_file "Lexend-Regular.ttf"

# Runtime directories/files required by player.html and loader.js.
copy_file "data/emulator.min.js"
copy_file "data/emulator.min.css"
copy_file "data/emulator.override.js"
copy_file "data/loader.js"
copy_dir "data/compression"

# Selected core assets and reports.
for core in "${SELECTED_CORES[@]}"; do
  copy_file "data/cores/${core}-wasm.data"
  copy_file "data/cores/${core}-legacy-wasm.data"
  copy_file_if_exists "data/cores/${core}-thread-wasm.data"
  copy_file_if_exists "data/cores/${core}-thread-legacy-wasm.data"
  copy_file "data/cores/reports/${core}.json"
done

mkdir -p "$(dirname -- "${OUTPUT_PATH}")"
rm -f -- "${OUTPUT_PATH}"
(cd "${STAGE_DIR}" && zip -r -9 "${OUTPUT_PATH}" . >/dev/null)

ZIP_BYTES="$(wc -c < "${OUTPUT_PATH}" | tr -d ' ')"
ZIP_MIB="$(awk "BEGIN { printf \"%.2f\", ${ZIP_BYTES}/1024/1024 }")"

echo "Created: ${OUTPUT_PATH}"
echo "Size: ${ZIP_BYTES} bytes (${ZIP_MIB} MiB)"
echo "Included cores (${#SELECTED_CORES[@]}): ${SELECTED_CORES[*]}"
