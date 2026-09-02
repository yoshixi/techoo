#!/usr/bin/env bash
# Per-boot initialization for the Techoo Cloud Agent environment.
#
# Determinate Nix is installed with `--init none` (the VM has no systemd), so
# the nix-daemon is not started automatically. This script (re)launches it on
# every boot. It is idempotent: if the daemon is already serving requests it
# returns immediately.
set -euo pipefail

DAEMON_SOCKET="/nix/var/nix/daemon-socket/socket"
DETERMINATE_NIXD="/usr/local/bin/determinate-nixd"

daemon_ready() {
  [ -S "$DAEMON_SOCKET" ] && pgrep -x nix-daemon >/dev/null 2>&1
}

if daemon_ready; then
  echo "[start] nix-daemon already running"
  exit 0
fi

if [ ! -x "$DETERMINATE_NIXD" ]; then
  echo "[start] $DETERMINATE_NIXD not found; is Nix installed? (install.sh runs it)" >&2
  exit 1
fi

echo "[start] launching nix-daemon via determinate-nixd"
sudo setsid nohup "$DETERMINATE_NIXD" daemon >/tmp/nix-daemon.log 2>&1 </dev/null &

# Wait for the daemon socket to become available.
for _ in $(seq 1 60); do
  daemon_ready && break
  sleep 1
done

if daemon_ready; then
  echo "[start] nix-daemon is ready"
else
  echo "[start] nix-daemon failed to become ready; see /tmp/nix-daemon.log" >&2
  tail -n 20 /tmp/nix-daemon.log 2>/dev/null || true
  exit 1
fi
