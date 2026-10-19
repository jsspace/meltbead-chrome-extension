import perler from './vendor/palettes/perler-103.js';
import hama from './vendor/palettes/hama.js';
import artkal from './vendor/palettes/artkal-s.js';
import nabbi from './vendor/palettes/nabbi.js';
import mard185 from './vendor/palettes/mard-185.js';
import mard from './vendor/palettes/mard.js';
import mard291 from './vendor/palettes/mard-291.js';

const rawPalettes = [perler, hama, artkal, nabbi, mard185, mard, mard291];

export const palettes = rawPalettes.map((palette) => ({
  ...palette,
  label: `${palette.brand} ${palette.series} (${palette.colors.length})`,
  // Effect finishes are not faithfully described by one RGB value.
  matchingColors: palette.colors.filter((color) => color.hex && color.rgb && color.finish === 'solid'),
}));

export function getPalette(id) {
  return palettes.find((palette) => palette.id === id);
}
