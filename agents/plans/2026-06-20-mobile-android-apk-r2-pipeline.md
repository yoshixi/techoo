**Date:** 2026-06-20
**Status:** Accepted
**Branch:** mobile-android-apk-r2-pipeline

---

# Mobile Android APK R2 pipeline

## Goal

Automate sideload distribution: EAS Android build (AAB) → universal APK → Cloudflare R2 `sandbox` bucket.

## Script

`scripts/release-android-apk.sh`

Run from repo root inside the Nix dev shell:

```bash
nix develop --command ./scripts/release-android-apk.sh
```

## Steps

1. **EAS build** — `eas build -p android --profile production --wait --json --non-interactive` from `apps/mobile`
2. **Download AAB** — artifact URL from `eas build:view <id> --json`
3. **Convert** — existing `scripts/aab-to-apk.sh` (debug keystore by default)
4. **Upload** — `wrangler r2 object put sandbox/techoo-latest.apk --remote`

## Auth

| Service | Interactive | CI |
|---------|-------------|-----|
| EAS | `eas login` | `EXPO_TOKEN` |
| R2 | `wrangler login` | `CLOUDFLARE_API_TOKEN` |

## Defaults

- EAS profile: `production` (must output an AAB; `preview` builds an APK — sideload that directly)
- EAS config: `apps/mobile/eas.json` and `apps/mobile/app.json`
- Artifacts: `tmp/techoo-latest.{aab,apk}`
- R2 bucket/key: `sandbox` / `techoo-latest.apk` (override with `--r2-bucket`, `--r2-key`, or env)
- APK signing: debug keystore via `aab-to-apk.sh` (fine for sandbox sideloading; not the EAS production key)

## Partial runs

- `--build-id <id>` — reuse a finished EAS build
- `--aab path/to/app.aab` — skip build/download
- `--skip-upload` — local conversion only
