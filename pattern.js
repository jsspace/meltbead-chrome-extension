export function closestColor(target, palette) {
  if (!palette.length) throw new Error('This palette has no colors available for matching.');
  let closest = palette[0];
  let best = Infinity;
  for (const color of palette) {
    const mean = (target.r + color.rgb.r) / 2;
    const dr = target.r - color.rgb.r;
    const dg = target.g - color.rgb.g;
    const db = target.b - color.rgb.b;
    const distance = (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
    if (distance < best) {
      best = distance;
      closest = color;
    }
  }
  return closest;
}

function representativeColor(image, x0, y0, x1, y1) {
  const { data, width } = image;
  let count = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 96) continue;
      count += 1;
      r += data[offset];
      g += data[offset + 1];
      b += data[offset + 2];
    }
  }
  return count ? { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) } : null;
}

export function generatePattern(image, { width, maxColors, palette }) {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
      image.width < 1 || image.height < 1 || image.data?.length !== image.width * image.height * 4) {
    throw new TypeError('A valid RGBA image is required.');
  }
  if (!Number.isInteger(width) || width < 16 || width > 96) throw new RangeError('Width must be 16–96 beads.');
  if (!Number.isInteger(maxColors) || maxColors < 2 || maxColors > 64) throw new RangeError('Color limit must be 2–64.');
  if (!palette?.length) throw new Error('Select a color palette.');
  const height = Math.max(1, Math.round(width * image.height / image.width));
  if (height > 240) throw new RangeError('The image is too tall. Crop it or choose a smaller grid width.');

  const cells = [];
  const frequency = new Map();
  for (let row = 0; row < height; row += 1) {
    const line = [];
    for (let col = 0; col < width; col += 1) {
      const x0 = Math.floor(col * image.width / width);
      const y0 = Math.floor(row * image.height / height);
      const x1 = Math.min(image.width, Math.max(x0 + 1, Math.ceil((col + 1) * image.width / width)));
      const y1 = Math.min(image.height, Math.max(y0 + 1, Math.ceil((row + 1) * image.height / height)));
      const sample = representativeColor(image, x0, y0, x1, y1);
      if (!sample) {
        line.push(null);
        continue;
      }
      const color = closestColor(sample, palette);
      line.push(color);
      frequency.set(color.code, (frequency.get(color.code) ?? 0) + 1);
    }
    cells.push(line);
  }

  const selected = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
    .map(([code]) => palette.find((color) => color.code === code));
  const counts = new Map();
  for (const row of cells) {
    for (let col = 0; col < row.length; col += 1) {
      if (!row[col]) continue;
      const color = closestColor(row[col].rgb, selected);
      row[col] = color;
      counts.set(color.code, (counts.get(color.code) ?? 0) + 1);
    }
  }
  const materials = [...counts.entries()]
    .map(([code, count]) => ({ ...selected.find((color) => color.code === code), count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  return { width, height, cells, materials, total: materials.reduce((sum, item) => sum + item.count, 0) };
}

export function materialsCsv(pattern, palette) {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [['palette', 'brand', 'series', 'code', 'name', 'hex', 'count']];
  for (const color of pattern.materials) {
    rows.push([palette.id, palette.brand, palette.series, color.code, color.name, color.hex, color.count]);
  }
  return `\uFEFF${rows.map((row) => row.map(quote).join(',')).join('\r\n')}\r\n`;
}
