import test from 'node:test';
import assert from 'node:assert/strict';
import { rasterType } from '../image-type.js';

test('recognizes PNG, JPG, and WebP when a server omits the correct MIME type', () => {
  assert.equal(rasterType(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png');
  assert.equal(rasterType(Uint8Array.from([255, 216, 255, 224])), 'image/jpeg');
  assert.equal(rasterType(Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])), 'image/webp');
  assert.equal(rasterType(new TextEncoder().encode('<html>not an image</html>')), null);
});
