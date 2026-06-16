import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const logos = [
  ["BBB", "BBB.jpg"],
  ["BTDT", "BTDT.jpg"],
  ["HPC", "HPC.png"],
  ["KD", "KD.jpg"],
  ["SK", "SK.png"],
  ["SLW", "SLW.png"],
];

const sourceDir = path.join(process.cwd(), "public", "logos", "winter-cup");
const outputDir = path.join(sourceDir, "transparent");

await fs.mkdir(outputDir, { recursive: true });

for (const [code, filename] of logos) {
  const input = path.join(sourceDir, filename);
  const image = sharp(input).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height);
  const queue = [];

  function isBackground(pixelIndex) {
    const offset = pixelIndex * info.channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);

    return red > 218 && green > 218 && blue > 218 && max - min < 28;
  }

  function push(x, y) {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) return;
    const pixelIndex = y * info.width + x;
    if (visited[pixelIndex] || !isBackground(pixelIndex)) return;
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  }

  for (let x = 0; x < info.width; x++) {
    push(x, 0);
    push(x, info.height - 1);
  }

  for (let y = 0; y < info.height; y++) {
    push(0, y);
    push(info.width - 1, y);
  }

  while (queue.length > 0) {
    const pixelIndex = queue.shift();
    const x = pixelIndex % info.width;
    const y = Math.floor(pixelIndex / info.width);
    data[pixelIndex * info.channels + 3] = 0;

    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(outputDir, `${code}.png`));
}

console.log("Winter Cup transparent logos generated.");
