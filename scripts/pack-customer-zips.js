/**
 * Package Mac + Windows customer downloads (one-click each).
 *
 * Expects (build first if missing):
 *   npm run dist:mac  → dist/mac-arm64/Raid of the Gel.app
 *   npm run dist:win  → dist/Raid of the Gel 1.0.0.exe (portable)
 *
 * Outputs:
 *   dist/Raid-of-the-Gel-mac.zip
 *   dist/Raid-of-the-Gel-windows.zip
 *   dist/CUSTOMER-DOWNLOADS.txt
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VER = PKG.version || '1.0.0';
const PRODUCT = PKG.productName || 'Raid of the Gel';

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function findMacApp() {
  const candidates = [
    path.join(DIST, 'mac-arm64', PRODUCT + '.app'),
    path.join(DIST, 'mac-universal', PRODUCT + '.app'),
    path.join(DIST, 'mac', PRODUCT + '.app'),
    path.join(DIST, 'mac-x64', PRODUCT + '.app')
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) return candidates[i];
  }
  if (!fs.existsSync(DIST)) return null;
  const dirs = fs.readdirSync(DIST);
  for (let d = 0; d < dirs.length; d++) {
    const p = path.join(DIST, dirs[d], PRODUCT + '.app');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findWinPortable() {
  const exact = path.join(DIST, PRODUCT + ' ' + VER + '.exe');
  if (fs.existsSync(exact)) return exact;
  if (!fs.existsSync(DIST)) return null;
  const files = fs.readdirSync(DIST);
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!/\.exe$/i.test(f)) continue;
    if (/Raid|Gel/i.test(f) && !/elevate/i.test(f)) {
      return path.join(DIST, f);
    }
  }
  // unpacked fallback
  const unpacked = path.join(DIST, 'win-unpacked', PRODUCT + '.exe');
  if (fs.existsSync(unpacked)) return unpacked;
  return null;
}

function zipStage(stageDir, outZip, entries) {
  if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
  const args = ['-ry', outZip].concat(entries);
  const r = spawnSync('zip', args, { cwd: stageDir, stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error('zip failed for ' + outZip);
  }
  const mb = Math.round(fs.statSync(outZip).size / 1024 / 1024);
  console.log('[pack] wrote', outZip, '(' + mb + ' MB)');
}

const HOW_MAC = `Raid of the Gel — Mac customers (one-click)

1. Unzip this archive completely.
2. You will see:  Raid of the Gel.app  (gel icon)
3. FIRST TIME (Gatekeeper — normal for indie apps):
     Right-click the app → Open → Open
4. AFTER THAT: double-click Raid of the Gel.app

Offline · no account · Apple Silicon (M1/M2/M3/M4)

Softened Realms
`;

const HOW_WIN = `Raid of the Gel — Windows customers (one-click)

1. Unzip this archive completely.
2. Double-click:  Raid of the Gel.exe
   (Portable — no installer. Keep the file wherever you like.)
3. If Windows SmartScreen appears:
     More info → Run anyway
   (Unsigned indie build — normal.)

Offline · no account · Windows 10/11 64-bit

Softened Realms
`;

const SUMMARY = `Raid of the Gel — customer downloads
=====================================

Mac:     Raid-of-the-Gel-mac.zip
         → unzip → right-click app → Open (once) → then double-click

Windows: Raid-of-the-Gel-windows.zip
         → unzip → double-click Raid of the Gel.exe

Rebuild both:
  npm run pack:customers

Dev one-click (project folder):
  Mac:     Play Raid of the Gel.app
  Windows: Play Raid of the Gel.vbs
`;

// ── Mac zip ──────────────────────────────────────────────────────────
const macApp = findMacApp();
const macOut = path.join(DIST, 'Raid-of-the-Gel-mac.zip');
if (macApp) {
  const stage = path.join(DIST, '_stage_mac');
  rmrf(stage);
  ensureDir(stage);
  const stageApp = path.join(stage, PRODUCT + '.app');
  const cp = spawnSync('cp', ['-R', macApp, stageApp], { stdio: 'inherit' });
  if (cp.status !== 0) throw new Error('mac copy failed');
  fs.writeFileSync(path.join(stage, 'HOW_TO_OPEN.txt'), HOW_MAC, 'utf8');
  fs.writeFileSync(path.join(stage, 'READ_ME_Mac.txt'), HOW_MAC, 'utf8');
  zipStage(stage, macOut, [PRODUCT + '.app', 'HOW_TO_OPEN.txt', 'READ_ME_Mac.txt']);
  rmrf(stage);
} else {
  console.warn('[pack] SKIP Mac — no .app found. Run: npm run dist:mac');
}

// ── Windows zip ──────────────────────────────────────────────────────
const winExe = findWinPortable();
const winOut = path.join(DIST, 'Raid-of-the-Gel-windows.zip');
if (winExe) {
  const stage = path.join(DIST, '_stage_win');
  rmrf(stage);
  ensureDir(stage);
  const destExe = path.join(stage, PRODUCT + '.exe');
  fs.copyFileSync(winExe, destExe);
  fs.writeFileSync(path.join(stage, 'HOW_TO_OPEN.txt'), HOW_WIN, 'utf8');
  fs.writeFileSync(path.join(stage, 'READ_ME_Windows.txt'), HOW_WIN, 'utf8');
  // Friendly name without version for customers
  zipStage(stage, winOut, [PRODUCT + '.exe', 'HOW_TO_OPEN.txt', 'READ_ME_Windows.txt']);
  rmrf(stage);
} else {
  console.warn('[pack] SKIP Windows — no portable .exe found. Run: npm run dist:win');
}

fs.writeFileSync(path.join(DIST, 'CUSTOMER-DOWNLOADS.txt'), SUMMARY, 'utf8');
fs.writeFileSync(path.join(DIST, 'HOW_TO_OPEN-mac.txt'), HOW_MAC, 'utf8');
fs.writeFileSync(path.join(DIST, 'HOW_TO_OPEN-windows.txt'), HOW_WIN, 'utf8');

console.log('');
console.log('=== Customer packages ===');
if (fs.existsSync(macOut)) console.log('  Mac:     ', macOut);
if (fs.existsSync(winOut)) console.log('  Windows: ', winOut);
console.log('  Index:   ', path.join(DIST, 'CUSTOMER-DOWNLOADS.txt'));
if (!fs.existsSync(macOut) && !fs.existsSync(winOut)) {
  process.exit(1);
}
