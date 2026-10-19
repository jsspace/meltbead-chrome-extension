import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePattern, materialsCsv } from '../pattern.js';
import { getPalette, palettes } from '../palettes.js';

const black = { code: 'B', name: 'Black', hex: '#000000', rgb: { r: 0, g: 0, b: 0 } };
const white = { code: 'W', name: 'White', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } };

function image(width, height, colors) {
  return { width, height, data: Uint8ClampedArray.from(colors.flat()) };
}

test('published palettes include all seven sets used by the website', () => {
  assert.deepEqual(palettes.map((palette) => palette.id),
    ['perler-103', 'hama', 'artkal-s', 'nabbi', 'mard-185', 'mard', 'mard-291']);
  assert.equal(getPalette('perler-103').colors.length, 103);
  assert.equal(getPalette('mard-291').colors.length, 291);
  for (const palette of palettes) assert.ok(palette.matchingColors.length > 0);
});

test('pattern maps pixels to bead codes and excludes transparent cells', () => {
  const pixels = image(16, 1, [
    ...Array.from({ length: 8 }, () => [2, 2, 2, 255]),
    ...Array.from({ length: 7 }, () => [250, 250, 250, 255]),
    [0, 0, 0, 0],
  ]);
  const pattern = generatePattern(pixels, { width: 16, maxColors: 2, palette: [black, white] });
  assert.equal(pattern.height, 1);
  assert.equal(pattern.total, 15);
  assert.deepEqual(pattern.materials.map(({ code, count }) => [code, count]), [['B', 8], ['W', 7]]);
  assert.equal(pattern.cells[0][15], null);
});

test('CSV escapes names, preserves Unicode, and includes selected palette', () => {
  const color = { ...black, name: 'Black, "夜"' };
  const pattern = generatePattern(image(16, 1, Array.from({ length: 16 }, () => [0, 0, 0, 255])),
    { width: 16, maxColors: 2, palette: [color] });
  const csv = materialsCsv(pattern, { id: 'test', brand: 'Test', series: 'Mini' });
  assert.match(csv, /^\uFEFF/);
  assert.match(csv, /"Black, ""夜"""/);
  assert.match(csv, /"test","Test","Mini","B"/);
});

test('oversized portrait patterns receive a useful error', () => {
  assert.throws(() => generatePattern(image(1, 16, Array.from({ length: 16 }, () => [0, 0, 0, 255])),
    { width: 96, maxColors: 2, palette: [black] }), /too tall/);
});
