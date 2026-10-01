// A pixel-difference tool for asking "is this change actually visible?".
// Keep it honest by pairing every comparison with a control pair of two shots of a scene
// that the change cannot touch; whatever the control differs by is animation noise.

import { readFileSync } from "node:fs";
import zlib from "node:zlib";

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png buffer");
  let off = 8;
  let w = 0,
    h = 0,
    depth = 0,
    color = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      color = data[9];
      if (data[12] !== 0) throw new Error("interlaced unsupported");
    } else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (depth !== 8 || (color !== 2 && color !== 6))
    throw new Error(`unsupported png depth=${depth} color=${color}`);
  const channels = color === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = v + a;
      else if (filter === 2) v = v + b;
      else if (filter === 3) v = v + ((a + b) >> 1);
      else if (filter === 4) {
        const pa = Math.abs(b - c),
          pb = Math.abs(a - c),
          pc = Math.abs(a + b - 2 * c);
        v = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, channels, px: out };
}

export function diffPng(a, b) {
  const A = decodePng(a),
    B = decodePng(b);
  if (A.w !== B.w || A.h !== B.h) throw new Error("size mismatch");
  let sum = 0,
    worst = 0,
    moved = 0;
  const n = A.w * A.h;
  for (let i = 0; i < n; i++) {
    const o = i * A.channels;
    const d =
      Math.abs(A.px[o] - B.px[o]) +
      Math.abs(A.px[o + 1] - B.px[o + 1]) +
      Math.abs(A.px[o + 2] - B.px[o + 2]);
    sum += d;
    if (d > worst) worst = d;
    if (d > 24) moved++;
  }
  return {
    size: `${A.w}x${A.h}`,
    meanChannelDelta: +(sum / n / 3).toFixed(4),
    maxPixelDelta: worst,
    percentPixelsMoved: +((moved / n) * 100).toFixed(3),
  };
}

const cli = process.argv.slice(2).filter((a) => a !== "--");
if (cli.length) {
  for (let i = 0; i + 2 < cli.length; i += 3) {
    const a = readFileSync(cli[i + 1]);
    const b = readFileSync(cli[i + 2]);
    console.log(cli[i], JSON.stringify(diffPng(a, b)));
  }
}
