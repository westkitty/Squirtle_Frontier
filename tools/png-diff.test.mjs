import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { decodePng, diffPng } from "./png-diff.mjs";

// A tiny encoder is enough to feed the decoder, and it pins the fact that this tool only
// understands the 8-bit RGB/RGBA non-interlaced PNGs that screenshots come in.
function png(
  width,
  height,
  pixels,
  { interlace = 0, depth = 8, color = 6 } = {},
) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = color;
  ihdr[12] = interlace;
  const channels = color === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const flat = (w, h, rgb) => {
  const b = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    b[i * 4] = rgb[0];
    b[i * 4 + 1] = rgb[1];
    b[i * 4 + 2] = rgb[2];
    b[i * 4 + 3] = 255;
  }
  return b;
};

test("the decoder reproduces the pixels that were encoded", () => {
  const img = png(2, 2, flat(2, 2, [10, 200, 40]));
  const d = decodePng(img);
  assert.deepEqual([d.w, d.h, d.channels], [2, 2, 4]);
  assert.deepEqual([...d.px.slice(0, 4)], [10, 200, 40, 255]);
});

test("identical images differ by nothing", () => {
  const a = png(3, 2, flat(3, 2, [7, 8, 9]));
  assert.deepEqual(diffPng(a, Buffer.from(a)), {
    size: "3x2",
    meanChannelDelta: 0,
    maxPixelDelta: 0,
    percentPixelsMoved: 0,
  });
});

test("one changed pixel is reported and counted only once", () => {
  const before = flat(3, 1, [100, 100, 100]);
  const after = Buffer.from(before);
  after[0] = after[1] = after[2] = 10;
  const r = diffPng(png(3, 1, before), png(3, 1, after));
  assert.equal(r.maxPixelDelta, 270); // one pixel, three channels
  assert.ok(Math.abs(r.percentPixelsMoved - 100 / 3) < 0.001);
  // The tool rounds its mean to four decimals, so compare with a tolerance.
  assert.ok(Math.abs(r.meanChannelDelta - 270 / 9) < 0.001);
});

test("a moved pixel below the threshold is not counted as moved", () => {
  const before = flat(2, 1, [50, 50, 50]);
  const after = Buffer.from(before);
  after[0] = 55;
  assert.equal(
    diffPng(png(2, 1, before), png(2, 1, after)).percentPixelsMoved,
    0,
  );
});

test("interlaced or paletted input is refused instead of silently decoded wrong", () => {
  assert.throws(
    () => decodePng(png(1, 1, flat(1, 1, [1, 2, 3]), { interlace: 1 })),
    /interlaced/,
  );
  assert.throws(
    () => decodePng(png(1, 1, flat(1, 1, [1, 2, 3]), { color: 3 })),
    /unsupported png/,
  );
  assert.throws(() => decodePng(Buffer.from("not a png at all")), /not a png/);
});
