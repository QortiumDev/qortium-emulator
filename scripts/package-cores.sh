#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

CORES_DIR="${REPO_ROOT}/data/cores"
BIOS_DIR="${REPO_ROOT}/data/bios"
OUTPUT_PATH="${REPO_ROOT}/dist-cores.zip"
RESOURCE_SERVICE="FILES"
RESOURCE_NAME="Emulator"
RESOURCE_IDENTIFIER="cores"
ARCHIVE_PREFIX="cores"
PRINT_PUBLISH_JSON=true

usage() {
  cat <<'USAGE'
Usage:
  scripts/package-cores.sh [--output <zip-path>] [--name <qdn-name>] [--identifier <id>] [--no-publish-json]

Options:
  --output <zip-path>   Output zip path. Defaults to ./dist-cores.zip at repo root.
  --name <qdn-name>     QDN name to use when publishing. Defaults to Emulator.
  --identifier <id>     QDN identifier to use when publishing. Defaults to cores.
  --no-publish-json     Skip printing the publish JSON payload template.
  --help                Show this help.

Notes:
  - Packages the entire data/cores directory recursively.
  - If data/bios exists, packages it at bios/... in the archive.
  - This is intentionally future-proof: newly added core files are included automatically.
  - Publish target is FILES service as a multi-file zip.
  - Core files are stored under cores/... (for example cores/fceumm-wasm.data).
  - BIOS files (when present) are stored under bios/... (for example bios/scph5501.bin).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      [[ $# -ge 2 ]] || { echo "Missing value for --output" >&2; exit 1; }
      OUTPUT_PATH="$2"
      shift 2
      ;;
    --name)
      [[ $# -ge 2 ]] || { echo "Missing value for --name" >&2; exit 1; }
      RESOURCE_NAME="$2"
      shift 2
      ;;
    --identifier)
      [[ $# -ge 2 ]] || { echo "Missing value for --identifier" >&2; exit 1; }
      RESOURCE_IDENTIFIER="$2"
      shift 2
      ;;
    --no-publish-json)
      PRINT_PUBLISH_JSON=false
      shift
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

if [[ ! -d "${CORES_DIR}" ]]; then
  echo "Missing cores directory: ${CORES_DIR}" >&2
  exit 1
fi

CORE_SOURCE_FILES="$(find "${CORES_DIR}" -type f | wc -l | tr -d ' ')"
if [[ "${CORE_SOURCE_FILES}" == "0" ]]; then
  echo "No core files found in ${CORES_DIR}" >&2
  exit 1
fi

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf -- "${STAGE_DIR}"' EXIT

cp -a -- "${CORES_DIR}" "${STAGE_DIR}/${ARCHIVE_PREFIX}"
declare -a ZIP_ROOTS=("${ARCHIVE_PREFIX}")
if [[ -d "${BIOS_DIR}" ]]; then
  BIOS_FILE_COUNT="$(find "${BIOS_DIR}" -type f | wc -l | tr -d ' ')"
  if [[ "${BIOS_FILE_COUNT}" != "0" ]]; then
    cp -a -- "${BIOS_DIR}" "${STAGE_DIR}/bios"
    ZIP_ROOTS+=("bios")
  fi
fi
STAGED_TOTAL_FILES="$(find "${STAGE_DIR}" -type f | wc -l | tr -d ' ')"

mkdir -p "$(dirname -- "${OUTPUT_PATH}")"
rm -f -- "${OUTPUT_PATH}"
(cd "${STAGE_DIR}" && zip -r -9 "${OUTPUT_PATH}" "${ZIP_ROOTS[@]}" >/dev/null)

ZIP_BYTES="$(wc -c < "${OUTPUT_PATH}" | tr -d ' ')"
ZIP_MIB="$(awk "BEGIN { printf \"%.2f\", ${ZIP_BYTES}/1024/1024 }")"

CORE_COUNT="$(find "${CORES_DIR}" -maxdepth 1 -type f -name '*-wasm.data' ! -name '*-legacy-wasm.data' | wc -l | tr -d ' ')"
LEGACY_COUNT="$(find "${CORES_DIR}" -maxdepth 1 -type f -name '*-legacy-wasm.data' | wc -l | tr -d ' ')"
REPORT_COUNT="$(find "${CORES_DIR}/reports" -maxdepth 1 -type f -name '*.json' 2>/dev/null | wc -l | tr -d ' ')"
BIOS_COUNT="0"
if [[ -d "${BIOS_DIR}" ]]; then
  BIOS_COUNT="$(find "${BIOS_DIR}" -type f | wc -l | tr -d ' ')"
fi

echo "Created: ${OUTPUT_PATH}"
echo "Size: ${ZIP_BYTES} bytes (${ZIP_MIB} MiB)"
echo "Included files: ${STAGED_TOTAL_FILES}"
echo "Core source files: ${CORE_SOURCE_FILES}"
echo "Core assets: ${CORE_COUNT} standard, ${LEGACY_COUNT} legacy, ${REPORT_COUNT} reports"
echo "BIOS assets: ${BIOS_COUNT}"
echo "Publish target: ${RESOURCE_SERVICE}/${RESOURCE_NAME}/${RESOURCE_IDENTIFIER}"
echo "Core base path after publish: /arbitrary/${RESOURCE_SERVICE}/${RESOURCE_NAME}/${RESOURCE_IDENTIFIER}?filepath=${ARCHIVE_PREFIX}/..."
if [[ "${BIOS_COUNT}" != "0" ]]; then
  echo "BIOS base path after publish: /arbitrary/${RESOURCE_SERVICE}/${RESOURCE_NAME}/${RESOURCE_IDENTIFIER}?filepath=bios/..."
fi

if [[ "${PRINT_PUBLISH_JSON}" == true ]]; then
  cat <<EOF

Publish payload template:
{
  "action": "PUBLISH_QDN_RESOURCE",
  "service": "${RESOURCE_SERVICE}",
  "name": "${RESOURCE_NAME}",
  "identifier": "${RESOURCE_IDENTIFIER}",
  "file": "${OUTPUT_PATH}",
  "isMultiFileZip": true
}
EOF
fi
