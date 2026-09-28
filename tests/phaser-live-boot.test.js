/**
 * Real double headless load: executes boot JS, asserts canvas ~1920x1080,
 * window.SR_PHASER_GAME, zero pageerrors. Writes phaser-launch-1/2.log
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const SCRATCH = process.env.GOAL_SCRATCH ||
  '/var/folders/fw/0_cfyf5s2mb1c50p8jn_z_nw0000gq/T/grok-goal-246b46bd18e6/implementer';

function assert(c, m) {
  if (!c) throw new Error(m || 'assert failed');
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
      const file = path.join(ROOT, decodeURIComponent(p));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      const ext = path.extname(file);
      const types = {
        '.html': 'text/html', '.js': 'application/javascript',
        '.jpg': 'image/jpeg', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json'
      };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    // install into project for this run
    const { execSync } = require('child_process');
    execSync('npm install --no-save playwright@1.49.1', { cwd: ROOT, stdio: 'inherit' });
    return require(path.join(ROOT, 'node_modules/playwright'));
  }
}

async function oneLaunch(browser, url, label) {
  const lines = [];
  const log = (s) => { lines.push(s); console.log(s); };
  log('=== ' + label + ' ===');
  log('url=' + url);

  const page = await browser.newPage({ viewport: { width: 980, height: 560 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  // Wait for Phaser boot (CDN + scenes)
  await page.waitForFunction(() => {
    return typeof window.Phaser !== 'undefined' &&
      window.SR_PHASER_GAME &&
      window.SR_PHASER_GAME.canvas;
  }, { timeout: 45000 });

  // Extra settle for HubScene
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const g = window.SR_PHASER_GAME;
    const c = g && g.canvas;
    const rect = c ? c.getBoundingClientRect() : null;
    return {
      hasPhaser: typeof window.Phaser !== 'undefined',
      hasGame: !!g,
      canvasW: c ? (c.width || c.clientWidth) : 0,
      canvasH: c ? (c.height || c.clientHeight) : 0,
      displayW: rect ? rect.width : 0,
      displayH: rect ? rect.height : 0,
      isRunning: g && g.isRunning,
      sceneKeys: g && g.scene && g.scene.scenes
        ? g.scene.scenes.map((s) => s.scene && s.scene.key).filter(Boolean)
        : []
    };
  });

  log(JSON.stringify(info, null, 2));
  log('pageErrors=' + (pageErrors.length ? pageErrors.join(' | ') : 'none'));
  log('consoleErrors=' + (consoleErrors.length ? consoleErrors.join(' | ') : 'none'));

  assert(info.hasPhaser, 'Phaser global missing');
  assert(info.hasGame, 'SR_PHASER_GAME missing');
  // Logical size 1920×1080; backing store may be 2× on retina (width attribute includes resolution)
  assert(info.canvasW >= 1800 && info.canvasW <= 4000, 'canvas width ~1920 (or HiDPI 2x), got ' + info.canvasW);
  assert(info.canvasH >= 1000 && info.canvasH <= 2200, 'canvas height ~1080 (or HiDPI 2x), got ' + info.canvasH);
  assert(pageErrors.length === 0, 'pageerrors: ' + pageErrors.join('; '));

  // Prefer zero console errors but allow Phaser texture 404 noise only if canvas lives
  const fatalConsole = consoleErrors.filter((t) =>
    /Uncaught|TypeError|ReferenceError|SR_COMBAT is not|is not defined/i.test(t)
  );
  assert(fatalConsole.length === 0, 'fatal console: ' + fatalConsole.join('; '));

  log('PASS live boot canvas ' + info.canvasW + 'x' + info.canvasH + ' scenes=' + info.sceneKeys.join(','));
  await page.close();
  return lines;
}

(async () => {
  fs.mkdirSync(SCRATCH, { recursive: true });
  let browser;
  let server;
  try {
    const pw = await loadPlaywright();
    const { chromium } = pw;
    const srv = await startServer();
    server = srv.server;
    const url = 'http://127.0.0.1:' + srv.port + '/';
    browser = await chromium.launch({ headless: true });

    const log1 = await oneLaunch(browser, url, 'phaser-launch-1');
    const log2 = await oneLaunch(browser, url, 'phaser-launch-2');

    fs.writeFileSync(path.join(SCRATCH, 'phaser-launch-1.log'), log1.join('\n') + '\n');
    fs.writeFileSync(path.join(SCRATCH, 'phaser-launch-2.log'), log2.join('\n') + '\n');
    fs.writeFileSync(path.join(SCRATCH, 'phaser-live-boot.log'), log1.concat(log2).join('\n') + '\n');

    try {
      const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCRATCH, 'phaser-hub.png') });
      await page.close();
    } catch (e) {
      fs.writeFileSync(path.join(SCRATCH, 'phaser-screenshot-note.log'), String(e));
    }

    console.log('ALL LIVE PHASER BOOT TESTS PASSED');
    process.exitCode = 0;
  } catch (e) {
    console.error(e);
    fs.writeFileSync(path.join(SCRATCH, 'phaser-live-boot-fail.log'), String(e.stack || e));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) server.close();
  }
})();
