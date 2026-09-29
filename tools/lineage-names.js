/* Codex (Slime Adventure lore.js) lineage names -> Phaser lineage names.
 * Founder decision 2026-09-28: the game uses the Phaser names. Plurals first. */
module.exports = [
  ['Emberhearts', 'Emberkin'], ['Emberheart', 'Emberkin'],
  ['Stoneguts', 'Stoneward'], ['Stonegut', 'Stoneward'],
  ['Zephyrkin', 'Zephyr'],
  ['Bloomcores', 'Bloomkin'], ['Bloomcore', 'Bloomkin'],
  ['Sparkcoils', 'Stormcores'], ['Sparkcoil', 'Stormcore'],
  ['Frostlens', 'Frostgel'],
  ['Umbrawisps', 'Shades'], ['Umbrawisp', 'Shade'],
  ['Luminjelly', 'Lumina'],
  ['Chromeblobs', 'Steelgels'], ['Chromeblob', 'Steelgel'],
  ['Venomgloops', 'Venomkin'], ['Venomgloop', 'Venomkin'],
  ['Prismhearts', 'Prisms'], ['Prismheart', 'Prism'],
  ['Magmacores', 'Magma kin'], ['Magmacore', 'Magma'],
  ['Tempestorbs', 'Tempests'], ['Tempestorb', 'Tempest'],
  ['Wisplings', 'Wisps'], ['Wispling', 'Wisp'],
  ['Riftgels', 'Abyss cores'], ['Riftgel', 'Abyss']
];
module.exports.apply = function (s) {
  module.exports.forEach(function (p) { s = s.replace(new RegExp('\\b' + p[0] + '\\b', 'g'), p[1]); });
  return s;
};
