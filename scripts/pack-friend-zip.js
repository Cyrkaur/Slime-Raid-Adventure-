/**
 * Zip the packaged mac app for friends — one-click after Gatekeeper allow.
 * Run after: npm run dist:mac
 * Output: dist/Raid-of-the-Gel-mac.zip
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'Raid-of-the-Gel-mac.zip');
const STAGE = path.join(DIST, '_friend_stage');

const HOW_TO = `Raid of the Gel — ONE-CLICK PLAY (macOS)

1. Unzip this archive completely.
2. You will see:
     • Raid of the Gel.app   ← this is the game (gel icon)
     • HOW_TO_OPEN.txt

3. FIRST TIME ONLY (macOS Gatekeeper):
     Right-click "Raid of the Gel.app" → Open → Open
     (Apple blocks unsigned apps once. This is normal.)

4. EVERY TIME AFTER:
     Double-click "Raid of the Gel.app"

5. In-game ⚙ : Sound · GFX · Fullscreen · Restart (wipes save)

Requirements: Apple Silicon Mac (M1 / M2 / M3 / M4).
Offline · no account · no install wizard.

Softened Realms
`;

function findApp() {
  const candidates = [
    path.join(DIST, 'mac-universal', 'Raid of the Gel.app'),
    path.join(DIST, 'mac', 'Raid of the Gel.app'),
    path.join(DIST, 'mac-arm64', 'Raid of the Gel.app'),
    path.join(DIST, 'mac-x64', 'Raid of the Gel.app')
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) return candidates[i];
  }
  if (!fs.existsSync(DIST)) return null;
  const dirs = fs.readdirSync(DIST);
  for (let d = 0; d < dirs.length; d++) {
    const p = path.join(DIST, dirs[d], 'Raid of the Gel.app');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

const appPath = findApp();
if (!appPath) {
  console.error('[pack-friend] No .app found under dist/. Run: npm run dist:mac');
  process.exit(1);
}

rmrf(STAGE);
fs.mkdirSync(STAGE, { recursive: true });

const stageApp = path.join(STAGE, 'Raid of the Gel.app');
const copy = spawnSync('cp', ['-R', appPath, stageApp], { stdio: 'inherit' });
if (copy.status !== 0) {
  console.error('[pack-friend] copy app failed');
  process.exit(copy.status || 1);
}

fs.writeFileSync(path.join(STAGE, 'HOW_TO_OPEN.txt'), HOW_TO, 'utf8');
// Double-click friendly alias name for Finder
fs.writeFileSync(path.join(STAGE, '← READ ME — how to open.txt'), HOW_TO, 'utf8');
fs.writeFileSync(path.join(DIST, 'HOW_TO_OPEN.txt'), HOW_TO, 'utf8');

if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

console.log('[pack-friend] zipping…');
const r = spawnSync(
  'zip',
  ['-ry', OUT, 'Raid of the Gel.app', 'HOW_TO_OPEN.txt', '← READ ME — how to open.txt'],
  { cwd: STAGE, stdio: 'inherit' }
);
if (r.status !== 0) {
  console.error('[pack-friend] zip failed');
  process.exit(r.status || 1);
}

rmrf(STAGE);
const st = fs.statSync(OUT);
console.log('[pack-friend] wrote', OUT, '(' + Math.round(st.size / 1024 / 1024) + ' MB)');
console.log('[pack-friend] Friend: unzip → right-click app → Open (once) → then double-click forever.');
