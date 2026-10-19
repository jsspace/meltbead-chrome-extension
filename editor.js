import { palettes, getPalette } from './palettes.js';
import { generatePattern, materialsCsv } from './pattern.js';
import { rasterType } from './image-type.js';

const $ = (id) => document.getElementById(id);
const paletteSelect = $('palette');
const status = $('status');
const previewCanvas = $('pattern-canvas');
const app = { source: null, sourceName: '', imageUrl: null, imageData: null, pattern: null, palette: null, selectedUrl: null, generation: 0, timer: null };

function showStatus(message, success = false) {
  status.textContent = message;
  status.classList.toggle('success', success);
}

function safeName(name) {
  return (name || 'meltbead-image').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 70) || 'meltbead-image';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function sourceFileName() {
  const type = app.source?.type;
  const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return `${safeName(app.sourceName)}.${extension}`;
}

function setSource(blob, name) {
  app.generation += 1;
  app.imageData = null;
  if (app.imageUrl) URL.revokeObjectURL(app.imageUrl);
  app.imageUrl = URL.createObjectURL(blob);
  app.source = blob;
  app.sourceName = name;
  app.pattern = null;
  $('source-image').src = app.imageUrl;
  $('source-name').textContent = name;
  $('source-preview').hidden = false;
  $('pattern-content').hidden = true;
  $('empty-state').hidden = false;
  $('pattern-summary').textContent = 'Generating pattern…';
  showStatus('Image loaded. Generating pattern…', true);
  scheduleGenerate(0);
}

function useFile(file) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    showStatus('Choose a PNG, JPG or WebP image.');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showStatus('Choose an image smaller than 15 MB.');
    return;
  }
  setSource(file, file.name || 'Uploaded image');
  $('remote-source').hidden = true;
}

async function loadRemote(requestPermission = true) {
  try {
    const url = new URL(app.selectedUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('This image URL cannot be opened. Save the image and upload it instead.');
    const origin = `${url.protocol}//${url.hostname}/*`;
    // Request directly from the click handler so Chrome retains the user gesture.
    const granted = requestPermission
      ? await chrome.permissions.request({ origins: [origin] })
      : await chrome.permissions.contains({ origins: [origin] });
    if (!granted) {
      showStatus('Access was not granted. Save the image and upload it instead.');
      return;
    }
    $('load-remote').disabled = true;
    showStatus('Loading the selected image…', true);
    let response = await fetch(url.href, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (response.status === 401 || response.status === 403) {
      response = await fetch(url.href, { credentials: 'include' });
    }
    if (!response.ok) throw new Error(`The image website returned ${response.status}. Save the image and upload it instead.`);
    const bytes = Number(response.headers.get('content-length'));
    if (bytes > 15 * 1024 * 1024) throw new Error('This image is larger than 15 MB. Save a smaller copy and upload it.');
    const blob = await response.blob();
    if (blob.size > 15 * 1024 * 1024) throw new Error('This image is larger than 15 MB. Save a smaller copy and upload it.');
    const type = rasterType(await blob.slice(0, 16).arrayBuffer());
    if (!type) {
      throw new Error('This image format is not supported. Save a PNG, JPG or WebP copy and upload it.');
    }
    let name = url.pathname.split('/').pop() || 'Web image';
    try { name = decodeURIComponent(name); } catch { /* Keep the URL filename. */ }
    setSource(new File([blob], name, { type }), name);
    $('remote-source').hidden = true;
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not load this image. Save it and upload it instead.');
  } finally {
    $('load-remote').disabled = false;
  }
}

async function imageDataFromBlob(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width < 1 || bitmap.height < 1) throw new Error('This image has no pixels.');
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    bitmap.close();
  }
}

function paintGrid(canvas, pattern, size, withLegend = false) {
  const legendHeight = withLegend ? 110 + Math.ceil(pattern.materials.length / 3) * 30 : 0;
  const margin = withLegend ? 28 : 0;
  canvas.width = pattern.width * size + margin * 2;
  canvas.height = pattern.height * size + margin * 2 + legendHeight;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fffdf9';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (withLegend) {
    context.fillStyle = '#352b25';
    context.font = 'bold 22px system-ui';
    context.fillText('Meltbead pattern', margin, 29);
    context.font = '13px system-ui';
    context.fillText(`${pattern.width} × ${pattern.height} beads  ·  ${pattern.total} beads  ·  ${pattern.materials.length} colors`, margin, 49);
  }
  for (let row = 0; row < pattern.height; row += 1) {
    for (let col = 0; col < pattern.width; col += 1) {
      const x = margin + col * size;
      const y = margin + row * size + (withLegend ? 62 : 0);
      context.fillStyle = '#e8e0d8';
      context.fillRect(x, y, size, size);
      context.fillStyle = '#fffdf9';
      context.fillRect(x + 1, y + 1, size - 1, size - 1);
      const cell = pattern.cells[row][col];
      if (cell) {
        context.fillStyle = cell.hex;
        context.beginPath();
        context.arc(x + size / 2, y + size / 2, size * .40, 0, 2 * Math.PI);
        context.fill();
        context.strokeStyle = 'rgba(0,0,0,.13)';
        context.stroke();
      }
    }
  }
  if (!withLegend) return;
  const start = margin + 62 + pattern.height * size + 29;
  context.fillStyle = '#352b25';
  context.font = 'bold 15px system-ui';
  context.fillText('Materials', margin, start);
  const columnWidth = (canvas.width - margin * 2) / 3;
  context.font = '12px system-ui';
  pattern.materials.forEach((color, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = margin + col * columnWidth;
    const y = start + 17 + row * 30;
    context.fillStyle = color.hex;
    context.fillRect(x, y, 16, 16);
    context.strokeStyle = '#0003';
    context.strokeRect(x, y, 16, 16);
    context.fillStyle = '#352b25';
    context.fillText(`${color.code}  × ${color.count}`, x + 23, y + 13, columnWidth - 30);
  });
}

function showPattern() {
  const { pattern } = app;
  $('pattern-summary').textContent = `${pattern.width} × ${pattern.height} beads · ${pattern.total} beads · ${pattern.materials.length} colors`;
  paintGrid(previewCanvas, pattern, 14);
  $('materials').replaceChildren(...pattern.materials.map((color) => {
    const item = document.createElement('div');
    item.className = 'material';
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = color.hex;
    const label = document.createElement('span');
    label.className = 'material-name';
    const code = document.createElement('strong');
    code.textContent = color.code;
    label.append(code, document.createTextNode(color.name));
    const count = document.createElement('span');
    count.className = 'material-count';
    count.textContent = String(color.count);
    item.append(swatch, label, count);
    return item;
  }));
  $('empty-state').hidden = true;
  $('pattern-content').hidden = false;
}

function scheduleGenerate(delay = 180) {
  app.generation += 1;
  clearTimeout(app.timer);
  if (app.source) app.timer = setTimeout(() => { void runGenerate(); }, delay);
}

async function runGenerate() {
  if (!app.source) return;
  const generation = ++app.generation;
  showStatus('Generating pattern…', true);
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const palette = getPalette(paletteSelect.value);
    const source = app.source;
    const image = app.imageData ?? await imageDataFromBlob(source);
    if (generation !== app.generation) return;
    app.imageData = image;
    const pattern = generatePattern(image, {
      width: Number($('grid-width').value),
      maxColors: Number($('max-colors').value),
      palette: palette.matchingColors,
    });
    if (generation !== app.generation) return;
    app.pattern = pattern;
    app.palette = palette;
    showPattern();
    showStatus('', true);
  } catch (error) {
    if (generation !== app.generation) return;
    app.pattern = null;
    $('pattern-content').hidden = true;
    $('empty-state').hidden = false;
    $('pattern-summary').textContent = 'Could not generate this pattern.';
    showStatus(error instanceof Error ? error.message : 'Could not generate a pattern from this image.');
  }
}

function downloadPng() {
  if (!app.pattern) return;
  const canvas = document.createElement('canvas');
  paintGrid(canvas, app.pattern, 22, true);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${safeName(app.sourceName)}-meltbead-pattern.png`);
    else showStatus('Could not export the PNG pattern.');
  }, 'image/png');
}

function downloadCsv() {
  if (!app.pattern) return;
  downloadBlob(new Blob([materialsCsv(app.pattern, app.palette)], { type: 'text/csv;charset=utf-8' }),
    `${safeName(app.sourceName)}-meltbead-materials.csv`);
}

function continueOnWebsite() {
  if (!app.source) return;
  downloadBlob(app.source, sourceFileName());
  void chrome.tabs.create({ url: 'https://meltbead.com/perler-bead-pattern-maker?utm_source=chrome_extension&utm_medium=referral&utm_campaign=pattern_refine' });
  showStatus('Source image downloaded. Upload it in the website editor to continue.', true);
}

async function initialize() {
  for (const palette of palettes) {
    const option = document.createElement('option');
    option.value = palette.id;
    option.textContent = palette.label;
    paletteSelect.append(option);
  }
  paletteSelect.value = 'perler-103';
  $('image-file').addEventListener('change', (event) => {
    useFile(event.target.files?.[0]);
    event.target.value = '';
  });
  const dropZone = $('drop-zone');
  dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    useFile(event.dataTransfer.files?.[0]);
  });
  $('load-remote').addEventListener('click', () => { void loadRemote(true); });
  paletteSelect.addEventListener('change', () => scheduleGenerate());
  $('grid-width').addEventListener('input', () => scheduleGenerate());
  $('max-colors').addEventListener('input', () => scheduleGenerate());
  $('download-png').addEventListener('click', downloadPng);
  $('download-csv').addEventListener('click', downloadCsv);
  $('continue-site').addEventListener('click', continueOnWebsite);

  const id = location.hash.slice(1);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const stored = await chrome.storage.session.get(id);
  if (typeof stored[id] !== 'string') return;
  app.selectedUrl = stored[id];
  try {
    $('source-domain').textContent = new URL(app.selectedUrl).host;
  } catch {
    $('source-domain').textContent = 'this page';
  }
  $('remote-source').hidden = false;
  const url = new URL(app.selectedUrl);
  if (['http:', 'https:'].includes(url.protocol) &&
      await chrome.permissions.contains({ origins: [`${url.protocol}//${url.hostname}/*`] })) {
    void loadRemote(false);
  }
}

initialize().catch(() => showStatus('Could not initialize the extension. Reload this page and try again.'));
