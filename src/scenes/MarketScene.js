/* Market shop — resource packs */
(function (global) {
  'use strict';

  class MarketScene extends Phaser.Scene {
    constructor() {
      super({ key: 'MarketScene' });
    }

    create() {
      const w = this.cameras.main.width;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      // Busy fantasy marketplace art (stalls, lanterns — not portals)
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_market_video', {
        wash: 0.14, washColor: 0x0c1a12, fallbackImage: 'mode_market'
      }))) {
        UI.paintModeBg(this, 'mode_market', '#0c1a12', 0.42);
      }
      UI.addBackButton(this);
      UI.addTitle(this, 'Market', 'Spend gold on supply packs and summon shards');
      UI.addCurrencyStrip(this, state, 40);

      const items = (global.SR_DATA && global.SR_DATA.MARKET_ITEMS) || [];
      items.forEach((item, i) => {
        const y = 138 + i * 52;
        const grant = Object.keys(item.grant || {}).map((k) => item.grant[k] + ' ' + k).join(', ');
        UI.addButton(this, w / 2, y, 520, 48,
          'Buy ' + item.name + ' — ' + item.cost + ' ' + item.currency + '  →  ' + grant,
          0x1a4428, () => {
            const res = global.SR_STATE.buyItem(state, item.id);
            UI.toast(this, res.ok ? 'Bought ' + item.name : res.error, res.ok);
            if (res.ok) this.scene.restart();
          });
      });
    }
  }

  global.MarketScene = MarketScene;
})(typeof window !== 'undefined' ? window : global);
