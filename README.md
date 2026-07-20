
# README

## Environement Setup

1. install devenv 

2. run `devenv shell` to enter the development environment.

## Running the Monorepo
To build all apps and packages, run the following command:

```sh
deven shell # login to the environment
pnpm run dev
```

## add new package to specific packages

```sh
 pnpm --filter web add -D drizzle-seed
```

## Run test 

You can run test by following command:

```sh
devenv shell -- pnpm run test

```

Also, the devenv allow to configure custom script. Here is an example script to run web app test.

```sh
$ devenv tasks run web:test
```

## Location for planning doc

Please put the planning doc in the `ai-docs` directory. 

## Release

Run release commands from the repo root inside the Nix dev shell:

```sh
nix develop --command pnpm run release:electron patch
```

### Electron (desktop)

Desktop builds are published via GitHub Actions (`.github/workflows/release.yml`). The helper script `./scripts/release-electron.sh` (exposed as `pnpm run release:electron`) bumps the version, commits `apps/electron/package.json`, and creates a git tag.

**Version source:** the script uses the latest `v*.*.*` git tag as the current version (not only `package.json`), so tags created outside the script stay in sync.

```sh
# Patch bump (e.g. 0.0.9 → 0.0.10)
nix develop --command pnpm run release:electron patch

# Minor bump (e.g. 0.0.9 → 0.1.0)
nix develop --command pnpm run release:electron minor

# Major bump (e.g. 0.0.9 → 1.0.0)
nix develop --command pnpm run release:electron major

# Set an explicit version
nix develop --command pnpm run release:electron 1.2.3
```

Then push the commit and tag to trigger the workflow (macOS, Windows, and Linux artifacts uploaded to a GitHub Release):

```sh
git push origin main v0.0.10   # use the tag the script printed
```

**Requirements:** a clean working tree; repo secrets for signing and API URL (`ELECTRON_API_BASE_URL`, macOS signing keys). See `apps/electron/dev-logs/` for workflow notes.

**Local build only** (no GitHub Release):

```sh
nix develop --command pnpm --filter electron run build:mac    # or build:win / build:linux
```

### Mobile (Android)

Android release builds run on **Expo EAS** (cloud), not GitHub Actions. See [`apps/mobile/README.md`](apps/mobile/README.md) for app-specific setup (OAuth, env, EAS profiles).

**One-off EAS builds:**

```sh
# Production AAB (Google Play)
nix develop --command pnpm --filter mobile run build:android

# Internal APK (sideload directly; no AAB conversion)
nix develop --command pnpm --filter mobile exec eas build -p android --profile preview
```

**Full pipeline (EAS → APK → R2 upload):**

Builds on EAS, converts the production AAB to a sideloadable APK, and uploads to Cloudflare R2:

```sh
nix develop --command pnpm run release:android-apk
```

Auth before running: `eas login` (or `EXPO_TOKEN`) and `wrangler login` (or `CLOUDFLARE_API_TOKEN`). Defaults: EAS `production` profile, artifacts in `tmp/techoo-latest.{aab,apk}`, R2 object `sandbox/techoo-latest.apk`. Partial runs and flags: `./scripts/release-android-apk.sh --help`.

**Install on a device:**

| Build | Artifact | How to install |
|-------|----------|----------------|
| **Preview** profile | APK | Sideload the APK directly (USB, cloud link, etc.). |
| **Production** profile | AAB | Not installable as-is. Convert with `./scripts/aab-to-apk.sh`, or use the release pipeline above. |

Convert a production AAB to APK (runs in the Nix dev shell; includes `bundletool` and `adb`):

```sh
# Convert only
nix develop --command ./scripts/aab-to-apk.sh path/to/app.aab

# Convert and install over USB (USB debugging enabled)
nix develop --command ./scripts/aab-to-apk.sh path/to/app.aab --install

# Via pnpm (note -- before script arguments)
nix develop --command pnpm run aab-to-apk -- path/to/app.aab -o path/to/app.apk
```

Without USB: copy the `.apk` to the phone and open it; allow **Install unknown apps** if prompted. If a production-signed build is already installed, uninstall it first before sideloading an APK re-signed with the debug keystore.

More detail: [`apps/mobile/README.md`](apps/mobile/README.md), [`agents/plans/2026-06-20-mobile-android-apk-r2-pipeline.md`](agents/plans/2026-06-20-mobile-android-apk-r2-pipeline.md).

