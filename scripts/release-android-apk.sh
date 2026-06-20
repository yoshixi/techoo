#!/usr/bin/env bash
# Build Android via EAS, convert the AAB to a sideloadable APK, and upload to R2.
#
# Requires the Nix dev shell (eas, bundletool, wrangler):
#   nix develop --command ./scripts/release-android-apk.sh
#
# Auth:
#   EAS: `eas login` or EXPO_TOKEN
#   R2:  `wrangler login` or CLOUDFLARE_API_TOKEN
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
AAB_TO_APK="$SCRIPT_DIR/aab-to-apk.sh"

PROFILE="production"
BUILD_ID=""
USER_AAB=""
SKIP_BUILD=false
SKIP_UPLOAD=false
INSTALL=false
OUTPUT_DIR="$ROOT_DIR/tmp"
AAB_PATH=""
APK_PATH=""
R2_BUCKET="${R2_BUCKET:-sandbox}"
R2_OBJECT_KEY="${R2_OBJECT_KEY:-techoo-latest.apk}"
BUILD_MESSAGE=""

usage() {
  cat <<'EOF'
Usage: release-android-apk.sh [options]

Pipeline: EAS Android build -> AAB -> universal APK -> Cloudflare R2 upload.

Options:
  -e, --profile NAME      EAS build profile (default: production)
  -m, --message TEXT      EAS build message
      --build-id ID       Skip build; download this finished EAS build instead
      --aab PATH          Skip build/download; convert and upload this .aab file
      --output-dir PATH   Directory for downloaded/conversion artifacts (default: tmp/)
      --r2-bucket NAME    R2 bucket name (default: sandbox, or R2_BUCKET env)
      --r2-key NAME       R2 object key (default: techoo-latest.apk, or R2_OBJECT_KEY env)
      --skip-build          Skip EAS build (requires --build-id or --aab)
      --skip-upload         Convert only; do not upload to R2
      --install             Install the APK with adb after conversion
  -h, --help              Show this help

Environment:
  EXPO_TOKEN              Non-interactive EAS auth (CI)
  CLOUDFLARE_API_TOKEN    Non-interactive wrangler auth (CI)

Examples:
  nix develop --command ./scripts/release-android-apk.sh
  nix develop --command ./scripts/release-android-apk.sh --build-id 00000000-0000-0000-0000-000000000000
  nix develop --command ./scripts/release-android-apk.sh --aab tmp/app.aab --skip-upload
  nix develop --command ./scripts/release-android-apk.sh -e preview --install
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' not found. Run this script inside the Nix dev shell:" >&2
    echo "  nix develop --command $0 ..." >&2
    exit 1
  fi
}

parse_json_field() {
  local json="$1"
  local expr="$2"
  node -e "
    const data = JSON.parse(process.argv[1]);
    const builds = Array.isArray(data) ? data : [data];
    const raw =
      builds.find((entry) => {
        const platform = String(entry.platform || entry.build?.platform || '').toLowerCase();
        return platform === 'android';
      }) || builds[0];
    const build = raw?.build || raw;
    if (!build) process.exit(1);
    const value = (${expr});
    if (value === undefined || value === null || value === '') process.exit(1);
    process.stdout.write(String(value));
  " "$json"
}

ensure_eas_auth() {
  if [[ -n "${EXPO_TOKEN:-}" ]]; then
    return 0
  fi

  if ! (
    cd "$MOBILE_DIR"
    pnpm exec eas whoami >/dev/null 2>&1
  ); then
    echo "Error: not logged in to EAS. Run 'eas login' or set EXPO_TOKEN." >&2
    exit 1
  fi
}

ensure_wrangler_auth() {
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    return 0
  fi

  if ! wrangler whoami >/dev/null 2>&1; then
    echo "Error: not logged in to Cloudflare. Run 'wrangler login' or set CLOUDFLARE_API_TOKEN." >&2
    exit 1
  fi
}

fetch_build_json() {
  local id="$1"
  cd "$MOBILE_DIR"
  pnpm exec eas build:view "$id" --json 2>/dev/null
}

download_aab_from_build() {
  local id="$1"
  local dest="$2"
  local build_json artifact_url

  echo "Fetching EAS build metadata for $id..."
  build_json="$(fetch_build_json "$id")"

  local status
  status="$(parse_json_field "$build_json" "build.status")"
  if [[ "${status,,}" != "finished" ]]; then
    echo "Error: build $id is not finished (status: $status)." >&2
    exit 1
  fi

  artifact_url="$(parse_json_field "$build_json" "build.artifacts?.buildUrl || build.artifacts?.applicationArchiveUrl || build.artifacts?.url")"
  mkdir -p "$(dirname "$dest")"
  echo "Downloading AAB to $dest"
  curl -fsSL "$artifact_url" -o "$dest"
}

run_eas_build() {
  local build_json build_id

  echo "Starting EAS Android build (profile: $PROFILE)..."
  cd "$MOBILE_DIR"

  local eas_args=(
    build
    -p android
    -e "$PROFILE"
    --wait
    --json
    --non-interactive
  )
  if [[ -n "$BUILD_MESSAGE" ]]; then
    eas_args+=(-m "$BUILD_MESSAGE")
  fi

  build_json="$(pnpm exec eas "${eas_args[@]}" 2>/dev/null)"
  build_id="$(parse_json_field "$build_json" "build.id")"
  echo "EAS build finished: $build_id"
  BUILD_ID="$build_id"
}

upload_to_r2() {
  local file="$1"
  local object_path="$R2_BUCKET/$R2_OBJECT_KEY"

  echo "Uploading $file to r2://$object_path"
  wrangler r2 object put "$object_path" \
    --file="$file" \
    --content-type=application/vnd.android.package-archive \
    --remote
  echo "Uploaded to r2://$object_path"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -e | --profile)
      PROFILE="$2"
      shift 2
      ;;
    -m | --message)
      BUILD_MESSAGE="$2"
      shift 2
      ;;
    --build-id)
      BUILD_ID="$2"
      SKIP_BUILD=true
      shift 2
      ;;
    --aab)
      USER_AAB="$2"
      AAB_PATH="$2"
      SKIP_BUILD=true
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --r2-bucket)
      R2_BUCKET="$2"
      shift 2
      ;;
    --r2-key)
      R2_OBJECT_KEY="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-upload)
      SKIP_UPLOAD=true
      shift
      ;;
    --install)
      INSTALL=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      echo "Error: unexpected argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_cmd pnpm
require_cmd node
require_cmd curl
require_cmd wrangler

if [[ -z "$AAB_PATH" ]]; then
  AAB_PATH="$OUTPUT_DIR/techoo-latest.aab"
fi
if [[ -z "$APK_PATH" ]]; then
  APK_PATH="$OUTPUT_DIR/techoo-latest.apk"
fi

if [[ "$SKIP_BUILD" == true && -z "$BUILD_ID" && -z "$USER_AAB" ]]; then
  echo "Error: --skip-build requires --build-id or --aab." >&2
  exit 1
fi

if [[ "$SKIP_BUILD" == false ]]; then
  ensure_eas_auth
  run_eas_build
fi

if [[ -n "$BUILD_ID" ]]; then
  download_aab_from_build "$BUILD_ID" "$AAB_PATH"
elif [[ -n "$USER_AAB" ]]; then
  if [[ ! -f "$AAB_PATH" ]]; then
    echo "Error: AAB not found: $AAB_PATH" >&2
    exit 1
  fi
  echo "Using provided AAB: $AAB_PATH"
else
  echo "Error: no AAB available to convert." >&2
  exit 1
fi

convert_args=("$AAB_PATH" -o "$APK_PATH")
if [[ "$INSTALL" == true ]]; then
  convert_args+=(--install)
fi

echo "Converting AAB to APK..."
"$AAB_TO_APK" "${convert_args[@]}"

if [[ "$SKIP_UPLOAD" == true ]]; then
  echo "Skipping R2 upload (--skip-upload)."
  echo "APK ready at $APK_PATH"
  exit 0
fi

ensure_wrangler_auth
upload_to_r2 "$APK_PATH"

echo ""
echo "Done."
echo "  AAB: $AAB_PATH"
echo "  APK: $APK_PATH"
echo "  R2:  r2://$R2_BUCKET/$R2_OBJECT_KEY"
