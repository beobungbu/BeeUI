#!/usr/bin/env bash
set -euo pipefail

MAESTRO_VERSION="${MAESTRO_VERSION:-2.7.0}"

if ! command -v java >/dev/null 2>&1; then
  echo "Maestro requires Java 17+. Install Java before running this script." >&2
  exit 1
fi

java_major="$(java -version 2>&1 | awk -F '[\".]' 'NR==1 { if ($2 == "1") print $3; else print $2 }')"
if [ -z "$java_major" ] || [ "$java_major" -lt 17 ]; then
  echo "Maestro requires Java 17+. Found: $(java -version 2>&1 | head -n 1)" >&2
  exit 1
fi

current=""
if command -v maestro >/dev/null 2>&1; then
  current="$(maestro --version 2>/dev/null | awk '{print $NF}' | tr -d 'v')"
fi

if [ "$current" != "$MAESTRO_VERSION" ]; then
  echo "Installing Maestro CLI ${MAESTRO_VERSION}"
  export MAESTRO_VERSION
  curl -fsSL "https://get.maestro.mobile.dev" | bash
fi

export PATH="$HOME/.maestro/bin:$PATH"
if [ -n "${GITHUB_PATH:-}" ]; then
  printf '%s\n' "$HOME/.maestro/bin" >> "$GITHUB_PATH"
fi

maestro --version
