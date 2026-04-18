/**
 * generate-icons.js
 * Generates PNG icons for the Chrome extension (16, 48, 128px).
 * Requires only Node.js built-in modules (zlib, fs).
 */
import zlib from 'zlib';
import fs   from 'fs';

// ─── CRC32 ───────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ─── PNG builder ─────────────────────────────────────────────────────────────
function makeChunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function createPNG(w, h, pixels /* Uint8Array, RGB triples, row-major */) {
  // Raw scanlines: filter byte (0 = None) + RGB pixels
  const raw = Buffer.allocUnsafe(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: None
    raw.set(pixels.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Icon design ─────────────────────────────────────────────────────────────
// Palette
const BG     = [0x2B, 0x6C, 0xD4]; // #2B6CD4  brand blue
const HEADER = [0x1A, 0x47, 0x9A]; // #1A479A  dark blue for header row
const LINE   = [0xFF, 0xFF, 0xFF]; // white grid lines
const DOT    = [0xBF, 0xD8, 0xFF]; // light blue "cell dots"

function drawIcon(size) {
  const px = new Uint8Array(size * size * 3);

  const set = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    px[i] = rgb[0]; px[i+1] = rgb[1]; px[i+2] = rgb[2];
  };

  const fill = (x1, y1, x2, y2, rgb) => {
    for (let y = y1; y < y2; y++)
      for (let x = x1; x < x2; x++) set(x, y, rgb);
  };

  // ── Background ──
  fill(0, 0, size, size, BG);

  // ── Table geometry ──
  const pad  = Math.max(1, Math.round(size * 0.08)); // outer padding
  const lw   = Math.max(1, Math.round(size * 0.055)); // line width
  const tx   = pad, ty = pad;
  const tw   = size - pad * 2, th = size - pad * 2;
  const hdrH = Math.round(th * 0.26); // header row height

  const COLS = 3, ROWS = 3; // visible data rows

  // outer border
  fill(tx,           ty,           tx + tw,            ty + lw,        LINE); // top
  fill(tx,           ty + th - lw, tx + tw,            ty + th,        LINE); // bottom
  fill(tx,           ty,           tx + lw,            ty + th,        LINE); // left
  fill(tx + tw - lw, ty,           tx + tw,            ty + th,        LINE); // right

  // header background
  fill(tx + lw, ty + lw, tx + tw - lw, ty + hdrH, HEADER);

  // header bottom border
  fill(tx, ty + hdrH, tx + tw, ty + hdrH + lw, LINE);

  // column dividers (inside table)
  for (let c = 1; c < COLS; c++) {
    const cx = tx + Math.round(c * tw / COLS);
    fill(cx, ty + lw, cx + lw, ty + th - lw, LINE);
  }

  // row dividers (data area)
  const dataH = th - hdrH - lw;
  for (let r = 1; r < ROWS; r++) {
    const ry = ty + hdrH + lw + Math.round(r * dataH / ROWS);
    fill(tx + lw, ry, tx + tw - lw, ry + lw, LINE);
  }

  // ── Cell content dots (only for larger icons) ──
  if (size >= 48) {
    const dotR = Math.max(1, Math.round(size * 0.04));
    const colW = tw / COLS;
    const rowH2 = dataH / ROWS;

    // Draw small rectangles representing text content
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cx = tx + Math.round((c + 0.2) * colW) + lw;
        const cy = ty + hdrH + lw + Math.round((r + 0.35) * rowH2);
        const cw = Math.round(colW * 0.5);
        const ch = Math.max(1, dotR);
        fill(cx, cy, Math.min(cx + cw, tx + tw - lw), cy + ch, DOT);
      }
    }
  }

  return createPNG(size, size, px);
}

// ─── Generate ─────────────────────────────────────────────────────────────────
fs.mkdirSync('icons', { recursive: true });

for (const size of [16, 48, 128]) {
  const buf = drawIcon(size);
  fs.writeFileSync(`icons/icon${size}.png`, buf);
  console.log(`✓ icons/icon${size}.png  (${buf.length} bytes)`);
}
