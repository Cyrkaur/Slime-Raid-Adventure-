#!/bin/bash
# Double-click on Mac to play (no npm required).
# Opens a tiny local server + browser. Keep this window open while playing.
cd "$(dirname "$0")" || exit 1
PORT=8090
URL="http://127.0.0.1:${PORT}/index.html"

echo ""
echo "  Raid of the Gel"
echo "  Serving this folder on ${URL}"
echo "  Leave this window open. Close it to stop the game server."
echo ""

# Prefer python3, then python
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python is required (usually preinstalled on Mac)."
  echo "Install from https://www.python.org/downloads/ then try again."
  read -r -p "Press Enter to close…"
  exit 1
fi

# Open browser after a short delay so the server is up
(sleep 0.6; open "$URL" 2>/dev/null || true) &

# Bind localhost only
exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
