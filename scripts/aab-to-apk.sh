#!/usr/bin/env bash
# Convert an Android App Bundle (.aab) to an installable universal APK (.apk).
#
# Requires the Nix dev shell (bundletool, JDK 17, and adb are provided by flake.nix):
#   nix develop --command ./scripts/aab-to-apk.sh path/to/app.aab
#   nix develop --command ./scripts/aab-to-apk.sh path/to/app.aab -o path/to/app.apk
#
# By default, bundletool signs the APK with ~/.android/debug.keystore (created if
# missing). For production signing, pass EAS / Play upload keystore flags.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: aab-to-apk.sh [options] <input.aab> [output.apk]

Convert a signed or unsigned .aab to a universal .apk for sideloading.

Options:
  -o, --output PATH       Output .apk path (default: same basename as input)
  --ks PATH               Keystore for signing (production / EAS upload key)
  --ks-pass PASS          Keystore password
  --ks-key-alias ALIAS    Key alias in keystore
  --key-pass PASS         Key password
  --debug-keystore PATH   Debug keystore for sideload testing
                          (default: ~/.android/debug.keystore)
  --install               Install the APK with adb when a device is connected
  --keep-apks             Keep the intermediate .apks archive
  -h, --help              Show this help

Examples:
  nix develop --command ./scripts/aab-to-apk.sh tmp/app.aab
  nix develop --command ./scripts/aab-to-apk.sh tmp/app.aab -o tmp/app.apk --install
  nix develop --command ./scripts/aab-to-apk.sh tmp/app.aab \\
    --ks ./upload.jks --ks-pass pass:secret --ks-key-alias upload --key-pass pass:secret
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' not found. Run this script inside the Nix dev shell:" >&2
    echo "  nix develop --command $0 ..." >&2
    exit 1
  fi
}

ensure_debug_keystore() {
  local keystore="$1"

  if [[ -f "$keystore" ]]; then
    return 0
  fi

  require_cmd keytool

  echo "Creating debug keystore at $keystore"
  mkdir -p "$(dirname "$keystore")"
  keytool -genkeypair -v \
    -storetype PKCS12 \
    -keystore "$keystore" \
    -alias androiddebugkey \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass android \
    -keypass android \
    -dname "CN=Android Debug,O=Android,C=US"
}

INPUT_AAB=""
OUTPUT_APK=""
DEBUG_KEYSTORE="${HOME}/.android/debug.keystore"
INSTALL=false
KEEP_APKS=false
KS=""
KS_PASS=""
KS_KEY_ALIAS=""
KEY_PASS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o | --output)
      OUTPUT_APK="$2"
      shift 2
      ;;
    --ks)
      KS="$2"
      shift 2
      ;;
    --ks-pass)
      KS_PASS="$2"
      shift 2
      ;;
    --ks-key-alias)
      KS_KEY_ALIAS="$2"
      shift 2
      ;;
    --key-pass)
      KEY_PASS="$2"
      shift 2
      ;;
    --debug-keystore)
      DEBUG_KEYSTORE="$2"
      shift 2
      ;;
    --install)
      INSTALL=true
      shift
      ;;
    --keep-apks)
      KEEP_APKS=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    --)
      shift
      ;;
    -*)
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -z "$INPUT_AAB" ]]; then
        INPUT_AAB="$1"
      elif [[ -z "$OUTPUT_APK" ]]; then
        OUTPUT_APK="$1"
      else
        echo "Error: unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$INPUT_AAB" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "$INPUT_AAB" ]]; then
  echo "Error: input file not found: $INPUT_AAB" >&2
  exit 1
fi

case "$INPUT_AAB" in
  *.aab) ;;
  *)
    echo "Error: input must be an .aab file: $INPUT_AAB" >&2
    exit 1
    ;;
esac

if [[ -z "$OUTPUT_APK" ]]; then
  OUTPUT_APK="${INPUT_AAB%.aab}.apk"
fi

case "$OUTPUT_APK" in
  *.apk) ;;
  *)
    echo "Error: output must be an .apk file: $OUTPUT_APK" >&2
    exit 1
    ;;
esac

require_cmd bundletool
require_cmd unzip

APKS_FILE="$(mktemp "${TMPDIR:-/tmp}/aab-to-apk.XXXXXX.apks")"
cleanup() {
  if [[ "$KEEP_APKS" == false ]]; then
    rm -f "$APKS_FILE"
  else
    echo "Kept intermediate archive: $APKS_FILE"
  fi
}
trap cleanup EXIT

BUNDLETOOL_ARGS=(
  build-apks
  --bundle="$INPUT_AAB"
  --output="$APKS_FILE"
  --mode=universal
  --overwrite
)

if [[ -n "$KS" ]]; then
  BUNDLETOOL_ARGS+=(--ks="$KS")
  [[ -n "$KS_PASS" ]] && BUNDLETOOL_ARGS+=(--ks-pass="$KS_PASS")
  [[ -n "$KS_KEY_ALIAS" ]] && BUNDLETOOL_ARGS+=(--ks-key-alias="$KS_KEY_ALIAS")
  [[ -n "$KEY_PASS" ]] && BUNDLETOOL_ARGS+=(--key-pass="$KEY_PASS")
else
  ensure_debug_keystore "$DEBUG_KEYSTORE"
  BUNDLETOOL_ARGS+=(--ks="$DEBUG_KEYSTORE" --ks-pass=pass:android --ks-key-alias=androiddebugkey --key-pass=pass:android)
fi

echo "Converting $INPUT_AAB -> $OUTPUT_APK"
bundletool "${BUNDLETOOL_ARGS[@]}"

mkdir -p "$(dirname "$OUTPUT_APK")"
unzip -p "$APKS_FILE" universal.apk >"$OUTPUT_APK"

echo "Wrote $OUTPUT_APK ($(du -h "$OUTPUT_APK" | cut -f1))"

if [[ "$INSTALL" == true ]]; then
  require_cmd adb
  if ! adb get-state >/dev/null 2>&1; then
    echo "Error: no adb device connected (enable USB debugging and reconnect)." >&2
    exit 1
  fi
  echo "Installing on connected device..."
  adb install -r "$OUTPUT_APK"
  echo "Install complete."
fi
