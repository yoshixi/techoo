# Electron Release Workflow and Icon Generation

Date: 2026-01-12

## 1. GitHub Actions Release Workflow

Created `.github/workflows/release.yml` that:
- Triggers on tag push matching `v*.*.*` (e.g., `v1.0.2`)
- Builds in parallel on macOS, Windows, and Linux
- Uploads artifacts to GitHub Release

Updated `apps/electron/electron-builder.yml`:
- Changed publish provider to `github` (owner: yoshixi, repo: shuchu)

### Usage

```sh
git tag v1.0.0
git push origin v1.0.0
# GitHub Actions will automatically build and create a release
```

## 2. Icon Generation

Generated app icons from source files in `resources/`:
- `resources/logo.png` (420x421 PNG)
- `resources/logo@2x.png` (840x842 PNG)

### Commands Executed

```sh
# Create build directory
mkdir -p apps/electron/build

# Copy PNG for Linux icon
cp apps/electron/resources/logo@2x.png apps/electron/build/icon.png

# Create macOS iconset with all required sizes
ELECTRON_DIR="apps/electron"
mkdir -p "$ELECTRON_DIR/icon.iconset"
sips -z 16 16 "$ELECTRON_DIR/resources/logo@2x.png" --out "$ELECTRON_DIR/icon.iconset/icon_16x16.png"
sips -z 32 32 "$ELECTRON_DIR/resources/logo@2x.png" --out "$ELECTRON_DIR/icon.iconset/icon_16x16@2x.png"
sips -z 32 32 "$ELECTRON_DIR/resources/logo@2x.png" --out "$ELECTRON_DIR/icon.iconset/icon_32x32.png"
sips -z 64 64 "$ELECTRON_DIR/resources/logo@2x.png" --out "$ELECTRON_DIR/icon.iconset/icon_32x32@2x.png"
sips -z 128 128 "$ELECTRON_DIR/resources/logo@2x.png" --out "$ELECTRON_DIR/icon.iconset/icon_128x128.png"
sips -z 256 256 "$ELECTRON_DIR/resources/logo@2x.png" --out "$ELECTRON_DIR/icon.iconset/icon_128x128@2x.png"
sips -z 256 256 "$ELECTRON_DIR/resources/logo@2x.png" --out "$ELECTRON_DIR/icon.iconset/icon_256x256.png"
sips -z 512 512 "$ELECTRON_DIR/resources/logo@2x.png" --out "$ELECTRON_DIR/icon.iconset/icon_256x256@2x.png"
sips -z 512 512 "$ELECTRON_DIR/resources/logo@2x.png" --out "$ELECTRON_DIR/icon.iconset/icon_512x512.png"
sips -z 840 840 "$ELECTRON_DIR/resources/logo@2x.png" --out "$ELECTRON_DIR/icon.iconset/icon_512x512@2x.png"

# Convert iconset to .icns
iconutil -c icns "$ELECTRON_DIR/icon.iconset" -o "$ELECTRON_DIR/build/icon.icns"

# Cleanup
rm -rf "$ELECTRON_DIR/icon.iconset"
```

### Generated Files

| File | Purpose |
|------|---------|
| `build/icon.icns` | macOS app icon |
| `build/icon.png` | Linux app icon / Windows ico source |

### Source Files

| File | Size |
|------|------|
| `resources/logo.png` | 420x421 |
| `resources/logo@2x.png` | 840x842 |
