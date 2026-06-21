#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${REPO_ROOT}/dist"
CORES_CSV="${QORTIUM_EMULATOR_BUNDLED_CORES:-fceumm}"
INCLUDE_ALL_CORES=false

usage() {
  cat <<'USAGE'
Usage:
  scripts/build-dist.sh [--output <dir>] [--cores <comma-list>] [--all-cores] [--list-cores]

Options:
  --output <dir>   Build output directory. Defaults to ./dist.
  --cores <list>   Comma-separated core IDs to include. Defaults to QORTIUM_EMULATOR_BUNDLED_CORES or fceumm.
  --all-cores      Include every installed core in data/cores.
  --list-cores     Print installed core IDs and exit.
  --help           Show this help.
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      [[ $# -ge 2 ]] || { echo "Missing value for --output" >&2; exit 1; }
      OUTPUT_DIR="$2"
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

mapfile -t INSTALLED_CORES < <(list_installed_cores)
SELECTED_CORES=()

if [[ "${INCLUDE_ALL_CORES}" == true ]]; then
  SELECTED_CORES=("${INSTALLED_CORES[@]}")
elif [[ -n "${CORES_CSV}" ]]; then
  IFS=',' read -r -a raw_cores <<< "${CORES_CSV}"
  for core in "${raw_cores[@]}"; do
    core="$(echo "${core}" | xargs)"
    [[ -n "${core}" ]] && SELECTED_CORES+=("${core}")
  done
fi

for core in "${SELECTED_CORES[@]}"; do
  if ! contains_core "${core}" "${INSTALLED_CORES[@]}"; then
    echo "Selected core is not installed: ${core}" >&2
    echo "Installed cores:" >&2
    printf '  - %s\n' "${INSTALLED_CORES[@]}" >&2
    exit 1
  fi
done

if [[ "${OUTPUT_DIR}" != /* ]]; then
  OUTPUT_DIR="${REPO_ROOT}/${OUTPUT_DIR}"
fi

copy_file() {
  local rel="$1"
  local src="${REPO_ROOT}/${rel}"
  local dst="${OUTPUT_DIR}/${rel}"
  if [[ ! -f "${src}" ]]; then
    echo "Missing required file: ${rel}" >&2
    exit 1
  fi
  mkdir -p "$(dirname -- "${dst}")"
  cp -f -- "${src}" "${dst}"
}

copy_dir() {
  local rel="$1"
  local src="${REPO_ROOT}/${rel}"
  local dst="${OUTPUT_DIR}/${rel}"
  if [[ ! -d "${src}" ]]; then
    echo "Missing required directory: ${rel}" >&2
    exit 1
  fi
  mkdir -p "$(dirname -- "${dst}")"
  cp -a -- "${src}" "${dst}"
}

rm -rf -- "${OUTPUT_DIR}"
mkdir -p -- "${OUTPUT_DIR}"

copy_file "index.html"
copy_file "player.html"
copy_file "qortium-qortal-bridge.js"
copy_file "Lexend-Regular.ttf"
copy_file "favicon.ico"
copy_file "qortium-emulator-protoicon-black-transparent.png"
copy_file "qortium-emulator-protoicon-black-transparent.webp"

copy_file "data/emulator.min.js"
copy_file "data/emulator.min.css"
copy_file "data/emulator.override.js"
copy_file "data/loader.js"
copy_dir "data/compression"
mkdir -p -- "${OUTPUT_DIR}/data/cores/reports"
for core in "${SELECTED_CORES[@]}"; do
  copy_file "data/cores/${core}-wasm.data"
  copy_file "data/cores/${core}-legacy-wasm.data"
  if [[ -f "${REPO_ROOT}/data/cores/${core}-thread-wasm.data" ]]; then
    copy_file "data/cores/${core}-thread-wasm.data"
  fi
  if [[ -f "${REPO_ROOT}/data/cores/${core}-thread-legacy-wasm.data" ]]; then
    copy_file "data/cores/${core}-thread-legacy-wasm.data"
  fi
  copy_file "data/cores/reports/${core}.json"
done

echo "Included cores (${#SELECTED_CORES[@]}): ${SELECTED_CORES[*]:-none}"

echo "Built: ${OUTPUT_DIR}"
echo "Size: $(du -sh "${OUTPUT_DIR}" | awk '{print $1}')"
