#!/usr/bin/env bash
# Prepare the optional Cloudflare Zero Trust CA used by the container build.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
src="${CLOUDFLARE_ZT_CERT:-$HOME/.config/cloudflare/zero_trust_cert.pem}"
dst="$root/container/cloudflare_zero_trust.crt"
if [[ ! -f "$src" ]]; then
  : > "$dst"
  echo "no Zero Trust CA found; prepared a standard-trust build"
  exit 0
fi
cp "$src" "$dst"
echo "synced $src -> $dst"
