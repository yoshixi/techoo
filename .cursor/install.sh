#!/usr/bin/env bash
# Repository bootstrap for the Techoo Cloud Agent environment.
#
# Installs Determinate Nix (once), realizes the `nix develop` dev shell defined
# by flake.nix (Node 24, pnpm 11.20.0, JDK 17, Turso CLI, Wrangler, Python),
# and installs JS workspace dependencies with pnpm. Safe to run repeatedly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NIX_PROFILE="/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh"

# 1. Install Determinate Nix if it is not already present.
if [ ! -e "$NIX_PROFILE" ]; then
  echo "[install] installing Determinate Nix"
  curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix \
    | sh -s -- install linux --no-confirm --init none
else
  echo "[install] Nix already installed"
fi

# 2. Make sure the nix-daemon is running so we can build/realize store paths.
bash "$REPO_ROOT/.cursor/start.sh"

# 3. Put nix on PATH for this shell.
# shellcheck disable=SC1090
. "$NIX_PROFILE"

# 4. Warm the dev shell (downloads/builds the toolchain) and install JS deps.
#    Running inside `nix develop` guarantees the pinned Node/pnpm are used.
cd "$REPO_ROOT"
nix develop --command pnpm install --frozen-lockfile

echo "[install] done"
