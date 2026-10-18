const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function buildIcon() {
  const folder = path.join(__dirname, 'assets');
  const source = path.join(folder, 'ecl-logo.png');
  const { data, info } = await sharp(source).flatten({ background: '#000000' }).toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  // The source has large dark margins; fit the actual white mark, not that canvas.
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const pixel = (y * info.width + x) * info.channels;
    if (Math.min(data[pixel], data[pixel + 1], data[pixel + 2]) > 64) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('The ECL logo contains no visible mark.');
  const margin = Math.ceil((right - left + 1) * 0.04);
  left = Math.max(0, left - margin); top = Math.max(0, top - margin);
  right = Math.min(info.width - 1, right + margin); bottom = Math.min(info.height - 1, bottom + margin);
  const square = await sharp(source)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(224, 224, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  await fs.writeFile(path.join(folder, 'ecl-hub.png'), square);
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = await Promise.all(sizes.map(size => sharp(square).resize(size, size).png().toBuffer()));
  // ICO directory entries point to PNG-encoded images at each Windows icon size.
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((data, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = sizes[index] === 256 ? 0 : sizes[index];
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  await fs.writeFile(path.join(folder, 'ecl-hub.ico'), Buffer.concat([header, ...images]));
}
module.exports = { buildIcon };
