#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
BIN_DIR=$SCRIPT_DIR/.bin
BIN_NAME=viam-server
BIN_PATH=$BIN_DIR/$BIN_NAME

E2E_ORG_NAME="Viam Viz E2E"
ENV_FILE=$SCRIPT_DIR/.env.e2e

mkdir -p "$BIN_DIR"

echo "--- Installing viam-server ---"

if [ "$(uname)" == "Linux" ]; then
  if [ "$(uname -m)" == "aarch64" ]; then
    curl -fsSL https://storage.googleapis.com/packages.viam.com/apps/viam-server/viam-server-stable-aarch64 -o "$BIN_PATH"
  elif [ "$(uname -m)" == "x86_64" ]; then
    curl -fsSL https://storage.googleapis.com/packages.viam.com/apps/viam-server/viam-server-stable-x86_64 -o "$BIN_PATH"
  else
    echo "Cannot run E2E tests on $(uname -m)"
    exit 1
  fi
  chmod +x "$BIN_PATH"
  echo "Downloaded latest viam-server to $BIN_PATH"
elif [ "$(uname)" == "Darwin" ]; then
  brew tap viamrobotics/brews 2>/dev/null || true

  if brew list viam-server &>/dev/null; then
    brew upgrade viam-server 2>/dev/null || echo "viam-server is already up to date"
  else
    brew install viam-server
  fi

  VIAM_SERVER_BIN=$(which viam-server)
  ln -sf "$VIAM_SERVER_BIN" "$BIN_PATH"
  echo "Symlinked viam-server from $VIAM_SERVER_BIN to $BIN_PATH"
else
  echo "Unsupported platform: $(uname)"
  exit 1
fi

echo ""

echo "--- Building WorldStateStore test module ---"
WSS_MODULE_DIR=$SCRIPT_DIR/fixtures/world-state-store
WSS_MODULE_BIN=$BIN_DIR/world-state-store

if [ -d "$WSS_MODULE_DIR" ]; then
  (cd "$WSS_MODULE_DIR" && go build -o "$WSS_MODULE_BIN" .)
  echo "Built world-state-store to $WSS_MODULE_BIN"
else
  echo "WorldStateStore module directory not found at $WSS_MODULE_DIR."
  exit 1
fi

echo ""

echo "--- Checking Viam CLI authentication ---"

if ! command -v viam &> /dev/null; then
  echo ""
  echo "ERROR: Viam CLI not found. Install it first:"
  echo "  brew install viam (macOS)"
  echo "  Or see: https://docs.viam.com/dev/tools/cli/"
  exit 1
fi

WHOAMI_OUTPUT=$(viam whoami 2>&1) || true
if echo "$WHOAMI_OUTPUT" | grep -qi "not logged in\|error\|unauthorized"; then
  echo ""
  echo "ERROR: Not authenticated with the Viam CLI."
  echo "  Run: viam login"
  echo "  Then re-run this setup script."
  exit 1
fi

echo "Authenticated as:"
echo "$WHOAMI_OUTPUT"
echo ""

echo "--- Checking for '$E2E_ORG_NAME' organization ---"

ORG_LIST=$(viam organizations list 2>&1)
ORG_ID=$(echo "$ORG_LIST" | grep -i "$E2E_ORG_NAME" | head -1 | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1) || true

if [ -z "$ORG_ID" ]; then
  echo ""
  echo "No '$E2E_ORG_NAME' organization found."
  echo "Create one at: https://app.viam.com/ and name it exactly: $E2E_ORG_NAME"
  echo ""
  read -rp "Press Enter once you've created the org (or Ctrl+C to cancel)..." _
  echo ""

  ORG_LIST=$(viam organizations list 2>&1)
  ORG_ID=$(echo "$ORG_LIST" | grep -i "$E2E_ORG_NAME" | head -1 | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1) || true

  if [ -z "$ORG_ID" ]; then
    echo "Still can't find '$E2E_ORG_NAME'. Make sure the name matches exactly and re-run this script."
    exit 1
  fi
fi

echo "Found org '$E2E_ORG_NAME' with ID: $ORG_ID"
echo ""

echo "--- Creating E2E API key ---"

if [ -f "$ENV_FILE" ]; then
  echo "Existing API key file found at $ENV_FILE; rotating it."
  rm -f "$ENV_FILE"
fi

KEY_OUTPUT=$(viam organizations api-key create --org-id "$ORG_ID" --name "e2e-tests-$(date +%s)" 2>&1)
echo "$KEY_OUTPUT"

API_KEY_ID=$(echo "$KEY_OUTPUT" | grep -i "key id" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1) || true
API_KEY=$(echo "$KEY_OUTPUT" | grep -i "key value\|key:" | sed 's/.*: *//' | tr -d '[:space:]') || true

if [ -z "$API_KEY_ID" ] || [ -z "$API_KEY" ]; then
  echo ""
  echo "WARNING: Could not parse API key from CLI output."
  echo "Please manually create the file $ENV_FILE with:"
  echo "  VIAM_E2E_API_KEY_ID=<your-api-key-id>"
  echo "  VIAM_E2E_API_KEY=<your-api-key-value>"
  echo "  VIAM_E2E_ORG_ID=$ORG_ID"
  exit 1
fi

cat > "$ENV_FILE" <<EOL
VIAM_E2E_API_KEY_ID=$API_KEY_ID
VIAM_E2E_API_KEY=$API_KEY
VIAM_E2E_ORG_ID=$ORG_ID
EOL

echo "Wrote fresh credentials to $ENV_FILE"

echo ""
echo "=== Setup complete ==="
echo "Run e2e tests with: pnpm test:e2e"
