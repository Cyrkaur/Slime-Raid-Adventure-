const fs = require('fs');
const p = require('path').join(__dirname, '..', 'src', 'scenes', 'CampaignScene.js');
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('    /**\n     * Painted chapter map');
const end = s.indexOf('    // ─────────────────────────────────────────────\n    // VIEW 2 — Chapter stage map');
if (start < 0 || end < 0) {
  console.error('markers not found', start, end);
  process.exit(1);
}
const replacement = `    /**
     * Hand-painted chapter map image (full-screen), same art language as campaign.jpg.
     * Location pings sit on top. Soft vignette keeps UI readable.
     */
    drawChapterMapArt(reg) {
      const w = this.W;
      const h = this.H;
      const mapKey = reg.mapKey || ('map_' + (reg.id || 'greenwild'));
      const fallback = 'mode_campaign';

      this.cameras.main.setBackgroundColor(reg.mapBg || 0x0c1e16);

      let key = null;
      if (this.textures.exists(mapKey)) key = mapKey;
      else if (this.textures.exists(fallback)) key = fallback;

      if (key) {
        const img = this.add.image(w / 2, h / 2, key).setDepth(2);
        const scale = Math.max(w / img.width, h / img.height);
        img.setScale(scale);
        img.setAlpha(1);
      }

      // Soft top/bottom vignette so title + detail panel stay readable
      const top = this.add.graphics().setDepth(3);
      top.fillStyle(0x000000, 0.35);
      top.fillRect(0, 0, w, 96);
      const bot = this.add.graphics().setDepth(3);
      bot.fillStyle(0x000000, 0.28);
      bot.fillRect(0, h - 100, w, 100);
      const side = this.add.graphics().setDepth(3);
      side.fillStyle(0x000000, 0.12);
      side.fillRect(0, 0, 40, h);
      side.fillRect(w - 40, 0, 40, h);
    }

`;
s = s.slice(0, start) + replacement + s.slice(end);
s = s.replace('this.drawChapterMapArt(reg, mapX, mapY, mapW, mapH);', 'this.drawChapterMapArt(reg);');
s = s.replace(
  /      \/\/ Clear \/ solid base \(map art paints the chapter world\)\n      this\.cameras\.main\.setBackgroundColor\(reg\.mapBg \|\| 0x0c1e16\);\n/,
  ''
);
fs.writeFileSync(p, s);
console.log('OK patched', p);
