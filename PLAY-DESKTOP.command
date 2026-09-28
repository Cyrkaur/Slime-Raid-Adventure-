#!/bin/bash
cd "$(dirname "$0")" || exit 1
if [ -d "Play Raid of the Gel.app" ]; then
  open "Play Raid of the Gel.app"
  exit 0
fi
if [ -d "dist/mac-arm64/Raid of the Gel.app" ]; then
  open "dist/mac-arm64/Raid of the Gel.app"
  exit 0
fi
if [ ! -d node_modules/electron ]; then
  echo "Installing Electron (one-time)…"
  npm install
fi
echo "Launching Raid of the Gel desktop…"
npx electron .
