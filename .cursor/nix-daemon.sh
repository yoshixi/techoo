#!/usr/bin/env bash
# Long-running nix-daemon for the Techoo Cloud Agent environment, run as a
# tmux-backed `terminals` process.
#
# The VM has no systemd and Determinate Nix is installed with `--init none`, so
# the daemon must be supervised here. Running it in the foreground via a
# terminal keeps it alive for the life of the agent; a daemon merely backgrounded
# from `start` gets reaped once `start` returns.
set -euo pipefail

DETERMINATE_NIXD="/usr/local/bin/determinate-nixd"

if [ ! -x "$DETERMINATE_NIXD" ]; then
  echo "[nix-daemon] $DETERMINATE_NIXD not found; Nix must be installed first (install.sh)" >&2
  exit 1
fi

# Drop any stale socket captured in the environment snapshot so the daemon can
# bind cleanly on boot.
sudo rm -f /nix/var/nix/daemon-socket/socket 2>/dev/null || true

echo "[nix-daemon] starting determinate-nixd daemon (foreground)"
exec sudo "$DETERMINATE_NIXD" daemon
