#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PET_SOURCE = path.join(ROOT, 'src', 'assets', 'pets', 'nervy-sci-fi-kid', 'images', 'source', 'idle-standing.png');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'app-icon');
const ICONSET_DIR = path.join(OUT_DIR, 'FocusPet.iconset');
const MAIN_ICON = path.join(OUT_DIR, 'icon.png');
const ICNS_PATH = path.join(OUT_DIR, 'icon.icns');
const ICO_PATH = path.join(OUT_DIR, 'icon.ico');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ICON_SIZES = [16, 32, 64, 128, 256, 512, 1024];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return out;
}

function writePng(filePath, image) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = image.width * 4;
  const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    raw[y * (stride + 1)] = 0;
    image.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  fs.writeFileSync(filePath, Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND')
  ]));
}

function readPng(filePath) {
  const input = fs.readFileSync(filePath);
  if (!input.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`Not a PNG: ${filePath}`);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString('ascii', offset + 4, offset + 8);
    const data = input.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
        throw new Error(`Only non-interlaced 8-bit RGBA PNG is supported: ${filePath}`);
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filter = inflated[rowStart];
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[rowStart + 1 + x];
      const left = x >= 4 ? data[y * stride + x - 4] : 0;
      const up = y > 0 ? data[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? data[(y - 1) * stride + x - 4] : 0;
      let value = raw;
      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}: ${filePath}`);
      data[y * stride + x] = value & 255;
    }
  }
  return { width, height, data };
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const dl = Math.abs(estimate - left);
  const du = Math.abs(estimate - up);
  const dul = Math.abs(estimate - upLeft);
  if (dl <= du && dl <= dul) return left;
  return du <= dul ? up : upLeft;
}

function color(hex, alpha = 255) {
  const value = hex.replace(/^#/, '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha
  ];
}

function mixColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t)
  ];
}

function makeCanvas(size) {
  return { width: size, height: size, data: Buffer.alloc(size * size * 4) };
}

function blendPixel(image, x, y, rgba) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height || rgba[3] <= 0) return;
  const index = (y * image.width + x) * 4;
  const srcA = rgba[3] / 255;
  const dstA = image.data[index + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  for (let channel = 0; channel < 3; channel += 1) {
    const src = rgba[channel] / 255;
    const dst = image.data[index + channel] / 255;
    image.data[index + channel] = Math.round(((src * srcA) + (dst * dstA * (1 - srcA))) / outA * 255);
  }
  image.data[index + 3] = Math.round(outA * 255);
}

function roundedRectAlpha(px, py, x, y, width, height, radius) {
  const left = x + radius;
  const right = x + width - radius;
  const top = y + radius;
  const bottom = y + height - radius;
  const dx = px < left ? left - px : px > right ? px - right : 0;
  const dy = py < top ? top - py : py > bottom ? py - bottom : 0;
  const dist = Math.hypot(dx, dy);
  return Math.max(0, Math.min(1, radius + 1 - dist));
}

function drawRoundedRect(image, x, y, width, height, radius, fill) {
  const minX = Math.max(0, Math.floor(x));
  const maxX = Math.min(image.width, Math.ceil(x + width));
  const minY = Math.max(0, Math.floor(y));
  const maxY = Math.min(image.height, Math.ceil(y + height));
  for (let py = minY; py < maxY; py += 1) {
    for (let px = minX; px < maxX; px += 1) {
      const coverage = roundedRectAlpha(px + 0.5, py + 0.5, x, y, width, height, radius);
      if (coverage > 0) blendPixel(image, px, py, [fill[0], fill[1], fill[2], Math.round(fill[3] * coverage)]);
    }
  }
}

function drawGradientRoundedRect(image, x, y, width, height, radius, topLeft, bottomRight) {
  const minX = Math.max(0, Math.floor(x));
  const maxX = Math.min(image.width, Math.ceil(x + width));
  const minY = Math.max(0, Math.floor(y));
  const maxY = Math.min(image.height, Math.ceil(y + height));
  for (let py = minY; py < maxY; py += 1) {
    for (let px = minX; px < maxX; px += 1) {
      const coverage = roundedRectAlpha(px + 0.5, py + 0.5, x, y, width, height, radius);
      if (coverage <= 0) continue;
      const t = ((px - x) / width + (py - y) / height) / 2;
      const fill = mixColor(topLeft, bottomRight, t);
      blendPixel(image, px, py, [fill[0], fill[1], fill[2], Math.round(fill[3] * coverage)]);
    }
  }
}

function drawCircle(image, cx, cy, radius, fill) {
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(image.width, Math.ceil(cx + radius + 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(image.height, Math.ceil(cy + radius + 1));
  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const coverage = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy)));
      if (coverage > 0) blendPixel(image, x, y, [fill[0], fill[1], fill[2], Math.round(fill[3] * coverage)]);
    }
  }
}

function cropAlphaBounds(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return image;
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    image.data.copy(data, y * width * 4, ((minY + y) * image.width + minX) * 4, ((minY + y) * image.width + minX + width) * 4);
  }
  return { width, height, data };
}

function cropRect(image, x, y, width, height) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(image.width, Math.ceil(x + width));
  const bottom = Math.min(image.height, Math.ceil(y + height));
  const outWidth = Math.max(1, right - left);
  const outHeight = Math.max(1, bottom - top);
  const data = Buffer.alloc(outWidth * outHeight * 4);
  for (let row = 0; row < outHeight; row += 1) {
    image.data.copy(
      data,
      row * outWidth * 4,
      ((top + row) * image.width + left) * 4,
      ((top + row) * image.width + left + outWidth) * 4
    );
  }
  return { width: outWidth, height: outHeight, data };
}

function buildPortraitCrop(source) {
  const pet = cropAlphaBounds(source);
  const portraitHeight = Math.round(pet.height * 0.58);
  return cropAlphaBounds(cropRect(pet, 0, 0, pet.width, portraitHeight));
}

function resize(image, width, height) {
  const out = { width, height, data: Buffer.alloc(width * height * 4) };
  const scaleX = image.width / width;
  const scaleY = image.height / height;
  for (let y = 0; y < height; y += 1) {
    const srcY = (y + 0.5) * scaleY - 0.5;
    const y0 = Math.max(0, Math.floor(srcY));
    const y1 = Math.min(image.height - 1, y0 + 1);
    const ty = srcY - y0;
    for (let x = 0; x < width; x += 1) {
      const srcX = (x + 0.5) * scaleX - 0.5;
      const x0 = Math.max(0, Math.floor(srcX));
      const x1 = Math.min(image.width - 1, x0 + 1);
      const tx = srcX - x0;
      const index = (y * width + x) * 4;
      for (let c = 0; c < 4; c += 1) {
        const a = image.data[(y0 * image.width + x0) * 4 + c];
        const b = image.data[(y0 * image.width + x1) * 4 + c];
        const cc = image.data[(y1 * image.width + x0) * 4 + c];
        const d = image.data[(y1 * image.width + x1) * 4 + c];
        out.data[index + c] = Math.round((a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty);
      }
    }
  }
  return out;
}

function composite(dest, source, x, y) {
  for (let sy = 0; sy < source.height; sy += 1) {
    for (let sx = 0; sx < source.width; sx += 1) {
      const index = (sy * source.width + sx) * 4;
      blendPixel(dest, x + sx, y + sy, [
        source.data[index],
        source.data[index + 1],
        source.data[index + 2],
        source.data[index + 3]
      ]);
    }
  }
}

function compositeMasked(dest, source, x, y, maskAlpha) {
  for (let sy = 0; sy < source.height; sy += 1) {
    for (let sx = 0; sx < source.width; sx += 1) {
      const coverage = maskAlpha(x + sx + 0.5, y + sy + 0.5);
      if (coverage <= 0) continue;
      const index = (sy * source.width + sx) * 4;
      blendPixel(dest, x + sx, y + sy, [
        source.data[index],
        source.data[index + 1],
        source.data[index + 2],
        Math.round(source.data[index + 3] * coverage)
      ]);
    }
  }
}

function buildMinimalBackdrop() {
  const icon = makeCanvas(1024);
  drawRoundedRect(icon, 72, 88, 880, 880, 222, color('#101827', 18));
  drawGradientRoundedRect(icon, 56, 60, 912, 912, 228, color('#fbfffd'), color('#eef6ff'));
  drawCircle(icon, 512, 552, 348, color('#e4f7f2', 238));
  return icon;
}

function buildIcon() {
  const icon = buildMinimalBackdrop();
  const portrait = buildPortraitCrop(readPng(PET_SOURCE));
  const portraitHeight = 790;
  const portraitWidth = Math.round(portrait.width * portraitHeight / portrait.height);
  const resizedPortrait = resize(portrait, portraitWidth, portraitHeight);
  const portraitX = Math.round((1024 - portraitWidth) / 2);
  const portraitY = 146;
  compositeMasked(icon, resizedPortrait, portraitX, portraitY, (px, py) => {
    const distance = Math.hypot(px - 512, py - 552);
    return Math.max(0, Math.min(1, 348 - distance));
  });
  return icon;
}

function writeIco(filePath, pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = [];
  let offset = 6 + count * 16;
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry[0] = item.size >= 256 ? 0 : item.size;
    entry[1] = item.size >= 256 ? 0 : item.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(item.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += item.buffer.length;
  }
  fs.writeFileSync(filePath, Buffer.concat([header, ...entries, ...pngBuffers.map(item => item.buffer)]));
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.rmSync(ICONSET_DIR, { recursive: true, force: true });
  fs.mkdirSync(ICONSET_DIR, { recursive: true });

  const icon = buildIcon();
  const pngBuffers = [];
  for (const size of ICON_SIZES) {
    const image = size === 1024 ? icon : resize(icon, size, size);
    const filePath = path.join(OUT_DIR, size === 1024 ? 'icon.png' : `icon-${size}.png`);
    writePng(filePath, image);
    if ([16, 32, 64, 128, 256].includes(size)) pngBuffers.push({ size, buffer: fs.readFileSync(filePath) });
  }
  for (const [name, size] of [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ]) {
    const from = path.join(OUT_DIR, size === 1024 ? 'icon.png' : `icon-${size}.png`);
    fs.copyFileSync(from, path.join(ICONSET_DIR, name));
  }
  execFileSync('iconutil', ['-c', 'icns', '-o', ICNS_PATH, ICONSET_DIR], { stdio: 'inherit' });
  writeIco(ICO_PATH, pngBuffers);
  fs.rmSync(ICONSET_DIR, { recursive: true, force: true });
  console.log(JSON.stringify({ ok: true, icon: MAIN_ICON, icns: ICNS_PATH, ico: ICO_PATH }, null, 2));
}

if (require.main === module) main();

module.exports = {
  buildMinimalBackdrop,
  buildPortraitCrop,
  buildIcon,
  readPng,
  resize,
  writeIco,
  writePng
};
