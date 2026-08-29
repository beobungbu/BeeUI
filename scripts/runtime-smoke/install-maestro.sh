#!/usr/bin/env bash
set -euo pipefail

MAESTRO_VERSION="${MAESTRO_VERSION:-2.7.0}"
MAESTRO_HOME="${MAESTRO_HOME:-$HOME/.maestro}"
export PATH="$MAESTRO_HOME/bin:$PATH"

if ! command -v java >/dev/null 2>&1; then
  echo "Maestro requires Java 17+. Install Java before running this script." >&2
  exit 1
fi

java_major="$(java -version 2>&1 | awk -F '[\".]' 'NR==1 { if ($2 == "1") print $3; else print $2 }')"
if [ -z "$java_major" ] || [ "$java_major" -lt 17 ]; then
  echo "Maestro requires Java 17+. Found: $(java -version 2>&1 | head -n 1)" >&2
  exit 1
fi

maestro_version() {
  if command -v maestro >/dev/null 2>&1; then
    maestro --version 2>/dev/null | awk '{print $NF}' | tr -d 'v'
  fi
}

current="$(maestro_version)"
if [ "$current" != "$MAESTRO_VERSION" ]; then
  installed=false
  for attempt in 1 2 3; do
    echo "Installing Maestro CLI ${MAESTRO_VERSION} (attempt ${attempt}/3)"

    # The upstream bootstrapper performs a second archive download after this
    # request. A transient/truncated archive can therefore leave ~/.maestro
    # partially populated even when the bootstrap script itself was fetched.
    # Remove partial state and retry the whole bootstrap; then validate the
    # executable and exact pinned version before accepting the installation.
    rm -rf "$MAESTRO_HOME"
    export MAESTRO_VERSION

    set +e
    curl --retry 3 --retry-all-errors --retry-delay 2 -fsSL \
      "https://get.maestro.mobile.dev" | bash
    bootstrap_status=$?
    set -e

    export PATH="$MAESTRO_HOME/bin:$PATH"
    current="$(maestro_version)"
    if [ "$bootstrap_status" -eq 0 ] && [ "$current" = "$MAESTRO_VERSION" ]; then
      installed=true
      break
    fi

    echo "Maestro install attempt ${attempt} did not produce pinned version ${MAESTRO_VERSION}; found '${current:-missing}'." >&2
    if [ "$attempt" -lt 3 ]; then
      sleep $((attempt * 2))
    fi
  done

  if [ "$installed" != true ]; then
    echo "Failed to install Maestro CLI ${MAESTRO_VERSION} after 3 attempts." >&2
    exit 1
  fi
fi

if [ -n "${GITHUB_PATH:-}" ]; then
  printf '%s\n' "$MAESTRO_HOME/bin" >> "$GITHUB_PATH"
fi

current="$(maestro_version)"
if [ "$current" != "$MAESTRO_VERSION" ]; then
  echo "Maestro version verification failed: expected ${MAESTRO_VERSION}, got '${current:-missing}'." >&2
  exit 1
fi

maestro --version
