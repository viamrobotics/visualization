#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")

if [ -z "$VERSION" ]; then
  echo "Error: could not read version from package.json" >&2
  exit 1
fi

echo "Syncing Go module versions to v$VERSION"

# root go.mod: client and draw require lines
sed -i.bak -E \
  's|(github\.com/viam-labs/motion-tools/client) v[0-9]+\.[0-9]+\.[0-9]+|\1 v'"$VERSION"'|g' \
  go.mod

sed -i.bak -E \
  's|(github\.com/viam-labs/motion-tools/draw) v[0-9]+\.[0-9]+\.[0-9]+|\1 v'"$VERSION"'|g' \
  go.mod

# client/go.mod: draw require line
sed -i.bak -E \
  's|(github\.com/viam-labs/motion-tools/draw) v[0-9]+\.[0-9]+\.[0-9]+|\1 v'"$VERSION"'|g' \
  client/go.mod

rm -f go.mod.bak client/go.mod.bak

echo "Updated go.mod and client/go.mod to v$VERSION"
