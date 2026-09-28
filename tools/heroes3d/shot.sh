#!/bin/bash
# shot.sh out.png glb w h wait [extra.js] ; serves ~/reed-factory/work/slime-raid-phaser-ship on :8097
E="/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects/Slime-Raid-Phaser/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
R=${ROOT:-$HOME/reed-factory/work/slime-raid-phaser-ship}
curl -s -o /dev/null http://127.0.0.1:8097/ || { (cd "$R" && nohup python3 -m http.server 8097 --bind 127.0.0.1 >/tmp/srv8097.log 2>&1 &); sleep 1.5; }
"$E" ~/reed-factory/work/heroes3d/shot_main.js -- "http://127.0.0.1:8097/?t=$RANDOM" "$@" 2>/dev/null | grep -E '^OK'
