const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { buildIcon } = require('../icon.cjs');

test('builds a valid seven-size Windows ICO from the ECL logo', async () => {
  await buildIcon();
  const ico = await fs.readFile(path.join(__dirname, '../assets/ecl-hub.ico'));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 7);
  for (let index = 0; index < 7; index++) {
    const entry = 6 + index * 16;
    const size = ico[entry] || 256;
    const length = ico.readUInt32LE(entry + 8), offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset + length <= ico.length);
    const metadata = await sharp(ico.subarray(offset, offset + length)).metadata();
    assert.equal(metadata.width, size); assert.equal(metadata.height, size);
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.hasAlpha, true);
    const pixels = await sharp(ico.subarray(offset, offset + length)).ensureAlpha().raw().toBuffer();
    assert.equal(pixels[3], 0, `The ${size}px icon corner must be transparent.`);
  }
  const stats = await sharp(path.join(__dirname, '../assets/ecl-hub.png')).stats();
  assert.equal(stats.isOpaque, false);
  const rgba = await sharp(path.join(__dirname, '../assets/ecl-hub.png')).ensureAlpha().raw().toBuffer();
  assert.equal(rgba[3], 0, 'Toolbar logo must not have an opaque black background.');
  assert.ok(stats.channels[0].max - stats.channels[0].min > 150, 'Icon must contain a visible white ECL mark, not a blank square.');
  const { data, info } = await sharp(path.join(__dirname, '../assets/ecl-hub.png')).flatten({ background: '#000000' }).raw().toBuffer({ resolveWithObject: true });
  let left = info.width, right = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * info.channels] > 180) { left = Math.min(left, x); right = Math.max(right, x); }
  }
  assert.ok(right - left > 160, 'Logo should fill the icon rather than disappear into source-image margins.');
});
