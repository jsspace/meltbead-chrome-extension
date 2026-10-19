import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'icons');
mkdirSync(output, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}

function image(size) {
  const pixels = Buffer.alloc(size * (1 + size * 4));
  const color = (x, y) => {
    const edge = size * .125;
    const right = size - edge;
    const radius = size * .20;
    const nearestX = Math.max(edge + radius, Math.min(right - radius, x));
    const nearestY = Math.max(edge + radius, Math.min(right - radius, y));
    if ((x - nearestX) ** 2 + (y - nearestY) ** 2 > radius ** 2) return [0, 0, 0, 0];
    const beads = [
      [0.355, 0.355, [247, 204, 104, 255]],
      [0.645, 0.355, [255, 238, 219, 255]],
      [0.355, 0.645, [240, 140, 119, 255]],
      [0.645, 0.645, [191, 216, 189, 255]],
    ];
    for (const [cx, cy, shade] of beads) {
      if ((x - cx * size) ** 2 + (y - cy * size) ** 2 < (size * .10) ** 2) return shade;
    }
    return [169, 67, 49, 255];
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = y * (1 + size * 4) + 1 + x * 4;
      for (let channel = 0; channel < 4; channel += 1) pixels[offset + channel] = color(x + .5, y + .5)[channel];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(join(output, `icon${size}.png`), png);
}

for (const size of [16, 32, 48, 128]) image(size);
