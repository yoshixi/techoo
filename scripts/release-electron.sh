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

# Get current version
CURRENT_VERSION=$(node -p "require('$ELECTRON_DIR/package.json').version")
echo "Current version: $CURRENT_VERSION"

# Bump version using npm version (creates commit and tag)
cd "$ELECTRON_DIR"
NEW_VERSION=$(npm version "$VERSION_TYPE" --no-git-tag-version)
cd "$ROOT_DIR"

# Remove 'v' prefix if present for display
NEW_VERSION_CLEAN="${NEW_VERSION#v}"
echo "New version: $NEW_VERSION_CLEAN"

# Create a single commit with the version bump
git add "$ELECTRON_DIR/package.json"
git commit -m "chore(electron): release v$NEW_VERSION_CLEAN"

# Create the tag
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
