# Techo — mobile companion

Expo app aligned with [`docs/CONCEPT.md`](../../docs/CONCEPT.md): **today’s to-dos**, **posts** (day log), **calendar** (to-dos + Google events), **notes** (off-timeline), and **settings** (OAuth / calendars).

## API client

Regenerate from the Electron OpenAPI export (keeps types in sync with the backend):

```bash
pnpm --filter mobile run api:generate
```

## Run

From repo root (with dev env):

```bash
pnpm --filter mobile run dev
```

Configure API base URL for the mutator via your Expo env (see `.env_example`).

### Google sign-in (mobile)

The API validates `redirect_uri` from `expo-linking` before starting OAuth. **Expo Go** uses URLs like `exp://192.168.x.x:8081/--/auth-callback`; the backend allows those automatically (LAN, `127.0.0.1`, `.exp.direct`, `.expo.dev`, etc.). **Release builds** use `techoo://auth-callback` per `app.json` `scheme`. If you still see `Untrusted redirect_uri`, copy the exact URL from a debug log and add it to `MOBILE_REDIRECT_URIS` on the server, or deploy the backend with the latest `mobile-redirect` rules.

## Navigation (two tabs)

| Tab      | Role |
|----------|------|
| **Today** | **Plan** — to-dos for the selected day, week strip, “Next up” when viewing today. **Log** — that day’s posts + sticky composer. Mode is persisted (`AsyncStorage`). |
| **Library** | Calendar, all open to-dos, **Logbook** (last 14 days of posts), Notes, Settings — same screens as before, opened from one list (hidden from the tab bar). |

## Stack notes

- Expo Router, Nativewind, SWR + Orval-generated hooks (`gen/api/`)
- Modal routes: `todo/[id]`, `note/[id]`

Legacy **tasks / timers / tags** UI has been removed in favor of **todos** and **posts**.

## Android builds (EAS)

Production EAS builds produce an **AAB** (Android App Bundle) for Google Play, not a directly installable APK.

```bash
# Production AAB (Play Store)
nix develop --command pnpm --filter mobile run build:android

# Internal APK (easier to sideload; no conversion needed)
nix develop --command pnpm --filter mobile exec eas build -p android --profile preview
```

## Install on a device: AAB → APK

AAB files cannot be installed on a phone directly. Use the repo script to convert one to a universal APK. It runs inside the Nix dev shell (`bundletool` and `adb` come from `flake.nix`).

```bash
# Convert (output: same path with .apk extension)
nix develop --command ./scripts/aab-to-apk.sh path/to/app.aab

# Explicit output path
nix develop --command ./scripts/aab-to-apk.sh path/to/app.aab -o path/to/app.apk

# Convert and install over USB (USB debugging enabled)
nix develop --command ./scripts/aab-to-apk.sh path/to/app.aab --install
```

Via pnpm (note the `--` before script arguments):

```bash
nix develop --command pnpm run aab-to-apk -- path/to/app.aab -o path/to/app.apk
```

By default the script signs the APK with `~/.android/debug.keystore` (created if missing). That signature is fine for personal sideload testing; it is not the same as your EAS production keystore. For production signing, pass keystore flags:

```bash
nix develop --command ./scripts/aab-to-apk.sh path/to/app.aab \
  --ks ./upload.jks --ks-pass pass:secret \
  --ks-key-alias upload --key-pass pass:secret
```

See `./scripts/aab-to-apk.sh --help` for all options.

## Release pipeline: EAS → APK → R2

For a full cloud build, conversion, and upload to the `sandbox` R2 bucket:

```bash
nix develop --command ./scripts/release-android-apk.sh
# or
nix develop --command pnpm run release:android-apk
```

Auth required before running:

- **EAS:** `eas login` (or set `EXPO_TOKEN` for CI)
- **R2:** `wrangler login` (or set `CLOUDFLARE_API_TOKEN` for CI)

Defaults: EAS `production` profile, artifacts in `tmp/techoo-latest.{aab,apk}`, R2 key `sandbox/techoo-latest.apk`.

Partial runs:

```bash
# Reuse a finished EAS build
nix develop --command ./scripts/release-android-apk.sh --build-id <build-id>

# Convert and upload an existing AAB only
nix develop --command ./scripts/release-android-apk.sh --aab path/to/app.aab

# Build + convert locally without uploading
nix develop --command ./scripts/release-android-apk.sh --skip-upload
```

See `./scripts/release-android-apk.sh --help` and `agents/plans/mobile-android-apk-r2-pipeline.md`.

### Install the APK on your phone

**Option A — USB (adb)**

1. On the phone: enable **Developer options** → **USB debugging**.
2. Connect the phone and confirm the debugging prompt.
3. Run:

```bash
nix develop --command ./scripts/aab-to-apk.sh path/to/app.aab --install
```

Or install an existing APK:

```bash
nix develop --command adb install -r path/to/app.apk
```

**Option B — without USB**

1. Copy the `.apk` to the phone (AirDrop, cloud storage, email, etc.).
2. Open the file on the phone.
3. Allow **Install unknown apps** for the app you use to open the file (Files, Chrome, …) if prompted.
4. Tap **Install**.
