#!/usr/bin/env bash
# Repository bootstrap for the Techoo Cloud Agent environment.
#
# Installs single-user Nix, realizes the `nix develop` dev shell defined by
# flake.nix (Node 24, pnpm 11.20.0, JDK 17, Turso CLI, Wrangler, Python), and
# installs JS workspace dependencies with pnpm. Safe to run repeatedly.
#
# Single-user Nix means /nix is owned by this user and there is NO nix-daemon,
# so nothing needs to start per boot: `nix` works directly from the snapshotted
# /nix store on every boot. This keeps the environment robust on a VM with no
# init system (systemd).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NIX_USER_PROFILE="$HOME/.nix-profile/etc/profile.d/nix.sh"

# 1. Install single-user Nix if absent.
if [ ! -e "$NIX_USER_PROFILE" ]; then
  echo "[install] installing single-user Nix"
  installer="$(mktemp)"
  curl --proto '=https' --tlsv1.2 -sSf -L https://nixos.org/nix/install -o "$installer"
  # Run from a file (not a pipe) so the installer isn't consumed as its own stdin.
  sh "$installer" --no-daemon --yes </dev/null
  rm -f "$installer"
else
  echo "[install] Nix already installed"
fi

# 2. Enable flakes (idempotent).
sudo mkdir -p /etc/nix
if ! grep -qs 'experimental-features' /etc/nix/nix.conf 2>/dev/null; then
  echo 'experimental-features = nix-command flakes' | sudo tee -a /etc/nix/nix.conf >/dev/null
fi

# 3. Make nix available to every shell (the installer only edits ~/.profile).
if [ ! -e /etc/profile.d/nix-single-user.sh ]; then
  sudo tee /etc/profile.d/nix-single-user.sh >/dev/null <<'EOF'
if [ -e "$HOME/.nix-profile/etc/profile.d/nix.sh" ]; then
  . "$HOME/.nix-profile/etc/profile.d/nix.sh"
elif [ -e /home/ubuntu/.nix-profile/etc/profile.d/nix.sh ]; then
  . /home/ubuntu/.nix-profile/etc/profile.d/nix.sh
fi
EOF
fi
if ! grep -qs 'nix-single-user' /etc/bash.bashrc 2>/dev/null; then
  echo '[ -f /etc/profile.d/nix-single-user.sh ] && . /etc/profile.d/nix-single-user.sh  # nix-single-user' \
    | sudo tee -a /etc/bash.bashrc >/dev/null
fi

# 4. Source nix for the rest of this script.
# shellcheck disable=SC1090
. "$NIX_USER_PROFILE"

# 5. Warm the dev shell and install JS workspace dependencies.
cd "$REPO_ROOT"
nix develop --command pnpm install --frozen-lockfile

echo "[install] done"
