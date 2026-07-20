#!/bin/bash
set -e

# Release script for Electron app
# Usage: ./scripts/release-electron.sh [patch|minor|major|<version>]
# Example: ./scripts/release-electron.sh patch
# Example: ./scripts/release-electron.sh 1.2.3

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ELECTRON_DIR="$ROOT_DIR/apps/electron"

VERSION_TYPE="${1:-patch}"

if [ -z "$1" ]; then
    echo "Usage: $0 [patch|minor|major|<version>]"
    echo ""
    echo "Examples:"
    echo "  $0 patch   # 0.0.3 → 0.0.4"
    echo "  $0 minor   # 0.0.3 → 0.1.0"
    echo "  $0 major   # 0.0.3 → 1.0.0"
    echo "  $0 1.2.3   # Set specific version"
    exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Error: You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

LATEST_TAG_VERSION=""
LATEST_TAG=$(git tag -l 'v*.*.*' --sort=-v:refname | head -n1)
if [ -n "$LATEST_TAG" ]; then
    LATEST_TAG_VERSION="${LATEST_TAG#v}"
fi

PKG_VERSION=$(node -p "require('$ELECTRON_DIR/package.json').version")

# Prefer the latest release tag over package.json (tags may exist without a version bump commit).
if [ -n "$LATEST_TAG_VERSION" ]; then
    CURRENT_VERSION="$LATEST_TAG_VERSION"
else
    CURRENT_VERSION="$PKG_VERSION"
fi

echo "Current version: $CURRENT_VERSION (package.json: $PKG_VERSION${LATEST_TAG:+, latest tag: $LATEST_TAG})"

NEW_VERSION_CLEAN=$(node -e "
const current = process.argv[1];
const type = process.argv[2];

function bump(version, bumpType) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error('Invalid semver: ' + version);
  }
  if (bumpType === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (bumpType === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else if (bumpType === 'patch') {
    parts[2] += 1;
  } else if (/^\d+\.\d+\.\d+$/.test(bumpType)) {
    return bumpType;
  } else {
    throw new Error('Unknown version type: ' + bumpType);
  }
  return parts.join('.');
}

process.stdout.write(bump(current, type));
" "$CURRENT_VERSION" "$VERSION_TYPE")

echo "New version: $NEW_VERSION_CLEAN"

if git rev-parse "v$NEW_VERSION_CLEAN" >/dev/null 2>&1; then
    echo "Error: tag v$NEW_VERSION_CLEAN already exists."
    exit 1
fi

node -e "
const fs = require('fs');
const path = process.argv[1];
const version = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = version;
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
" "$ELECTRON_DIR/package.json" "$NEW_VERSION_CLEAN"

git add "$ELECTRON_DIR/package.json"
git commit -m "chore(electron): release v$NEW_VERSION_CLEAN"
git tag "v$NEW_VERSION_CLEAN"

echo ""
echo "Version bumped: $CURRENT_VERSION → $NEW_VERSION_CLEAN"
echo "Created tag: v$NEW_VERSION_CLEAN"
echo ""
echo "To publish the release, run:"
echo "  git push && git push --tags"
echo ""
echo "Or to push now, run:"
echo "  git push origin main v$NEW_VERSION_CLEAN"
