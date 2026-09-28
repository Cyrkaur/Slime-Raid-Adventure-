/**
 * Structural boot check: entry HTML + main.js create Phaser.Game with canvas size.
 * Launch evidence also written by scripts/launch-check.js when server available.
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRATCH = process.env.GOAL_SCRATCH ||
  '/var/folders/fw/0_cfyf5s2mb1c50p8jn_z_nw0000gq/T/grok-goal-8eaaebc09efb/implementer';

function assert(c, m) {
  if (!c) throw new Error(m || 'assert failed');
}

const lines = [];
function log(s) { lines.push(s); console.log(s); }

log('=== phaser-boot.test.js ===');

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert(/phaser@3|phaser\.min\.js|vendor\/phaser/i.test(index), 'Phaser 3 loaded (vendor or CDN)');
assert(/game-container/.test(index), 'game container');
assert(/src\/main\.js/.test(index), 'main boot script');
// Offline vendor pack (P3)
assert(fs.existsSync(path.join(ROOT, 'vendor/phaser.min.js')), 'vendor phaser.min.js');
assert(fs.existsSync(path.join(ROOT, 'vendor/three.min.js')), 'vendor three.min.js');
assert(fs.existsSync(path.join(ROOT, 'vendor/three.module.js')), 'vendor three.module.js');
assert(/audioBus\.js/.test(index), 'audio bus loaded');
// Desktop shell + packaging (C1–C2 goalpost)
assert(fs.existsSync(path.join(ROOT, 'electron/main.js')), 'electron/main.js desktop shell');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert(pkg.main === 'electron/main.js' || /electron/.test(pkg.main || ''), 'package main electron');
assert(pkg.scripts && pkg.scripts.desktop, 'npm run desktop script');
assert(pkg.scripts.dist || pkg.scripts['dist:mac'], 'dist packaging scripts');
assert(fs.existsSync(path.join(ROOT, 'build/icons/icon.icns')) ||
  fs.existsSync(path.join(ROOT, 'build/icons/icon.png')), 'app icon assets');
assert(fs.existsSync(path.join(ROOT, 'scripts/pack-friend-zip.js')), 'friend zip script');
assert(fs.existsSync(path.join(ROOT, 'SHARE.md')), 'SHARE.md for friends');
assert(fs.existsSync(path.join(ROOT, 'docs/ITCH_RELEASE.md')), 'itch release draft');
const packSrc = fs.readFileSync(path.join(ROOT, 'scripts/pack-friend-zip.js'), 'utf8');
assert(/HOW_TO_OPEN/.test(packSrc), 'friend zip includes HOW_TO_OPEN');
// One-click launchers
assert(fs.existsSync(path.join(ROOT, 'scripts/make-launchers.sh')), 'make-launchers script');
assert(
  fs.existsSync(path.join(ROOT, 'Play Raid of the Gel.app')) ||
  fs.existsSync(path.join(ROOT, 'Play Raid of the Gel.bat')),
  'one-click launcher present'
);
assert(fs.existsSync(path.join(ROOT, 'Play Raid of the Gel.bat')), 'Windows .bat launcher');
assert(fs.existsSync(path.join(ROOT, 'Play Raid of the Gel.vbs')), 'Windows .vbs launcher');
assert(fs.existsSync(path.join(ROOT, 'scripts/pack-customer-zips.js')), 'customer dual-OS pack script');
const custSrc = fs.readFileSync(path.join(ROOT, 'scripts/pack-customer-zips.js'), 'utf8');
assert(/Raid-of-the-Gel-windows\.zip/.test(custSrc) && /Raid-of-the-Gel-mac\.zip/.test(custSrc),
  'customer pack produces mac + windows zips');

const main = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
assert(/new Phaser\.Game/.test(main), 'creates Phaser.Game');
assert(
  (/width:\s*1920|GAME_W\s*=\s*1920|DESIGN_W\s*=\s*1920/.test(main)) &&
  (/height:\s*1080|GAME_H\s*=\s*1080|DESIGN_H\s*=\s*1080/.test(main)),
  'non-zero canvas size 1920x1080'
);
assert(/resolution/.test(main), 'HiDPI resolution set for crisp text');
assert(/BootScene|HubScene/.test(main), 'scenes registered');
assert(/three@|three\.min\.js|vendor\/three/i.test(index), 'Three.js for 3D gel slimes');
assert(fs.existsSync(path.join(ROOT, 'src/ui/slime3d.js')), 'slime3d.js present');
assert(fs.existsSync(path.join(ROOT, 'src/ui/battleWorld3d.js')), 'battleWorld3d.js present');
assert(/battleWorld3d\.js/.test(index), 'live battle 3D script loaded');
const s3 = fs.readFileSync(path.join(ROOT, 'src/ui/slime3d.js'), 'utf8');
assert(/bakeAll|SphereGeometry|WebGLRenderer|slime3d_/.test(s3), '3D gel bake pipeline');
const b3 = fs.readFileSync(path.join(ROOT, 'src/ui/battleWorld3d.js'), 'utf8');
assert(/SR_BATTLE3D|spawnTeams|WebGLRenderer/.test(b3), 'live battle 3D arena API');
const battle = fs.readFileSync(path.join(ROOT, 'src/scenes/BattleScene.js'), 'utf8');
assert(/live3d|SR_BATTLE3D|world3d/.test(battle), 'BattleScene wires live 3D');
log('PASS structural Phaser boot config');

// Verify combat + state scripts load without throw
const DATA = require(path.join(ROOT, 'src/data/gameData.js'));
global.SR_DATA = DATA;
const C = require(path.join(ROOT, 'src/systems/combat.js'));
const S = require(path.join(ROOT, 'src/systems/gameState.js'));
assert(C && S && DATA, 'core modules load');
log('PASS pure modules load in Node');

// Optional: fetch index via static server twice for launch logs
function serveAndFetch() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
      const file = path.join(ROOT, decodeURIComponent(p));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      const ext = path.extname(file);
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.jpg': 'image/jpeg', '.css': 'text/css' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const url = 'http://127.0.0.1:' + port + '/';
      let n = 0;
      function once(label) {
        http.get(url, (res) => {
          let body = '';
          res.on('data', (c) => { body += c; });
          res.on('end', () => {
            const ok = res.statusCode === 200 && /Phaser|Raid of the Gel/.test(body);
            log(label + ' status=' + res.statusCode + ' bytes=' + body.length + ' ok=' + ok);
            assert(ok, label + ' failed');
            n++;
            if (n >= 2) {
              server.close();
              resolve();
            } else {
              once('launch-2');
            }
          });
        }).on('error', (e) => {
          server.close();
          throw e;
        });
      }
      log('server port=' + port);
      once('launch-1');
    });
  });
}

serveAndFetch().then(() => {
  log('PASS double HTTP launch of index.html');
  log('ALL PHASER BOOT TESTS PASSED');
  fs.mkdirSync(SCRATCH, { recursive: true });
  const out = lines.join('\n') + '\n';
  // Structural/HTTP evidence only — Playwright live boot owns phaser-launch-1/2.log
  fs.writeFileSync(path.join(SCRATCH, 'phaser-boot.log'), out);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
