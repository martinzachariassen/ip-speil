// Compact binary (de)serialization for the built geoip tables.
//
// Parsing the raw DB-IP/iptoasn text at container startup was the actual cost
// behind the ~6-8GB RSS / ~30s boot this module replaces: splitting a 7.9M-line
// CSV and rebuilding fields character-by-character allocates and discards tens
// of millions of short-lived strings, and general-purpose allocators don't hand
// those pages back to the OS even after GC reclaims them — the process's
// resident memory stays inflated for its whole lifetime. Text parsing only
// needs to happen once, at Docker build time (fetch-datasets.ts); the runtime
// container just reads this format's typed-array columns back as near-zero-copy
// views over the file's own read buffer — no per-row allocation at all.

import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

export type ColKind = "u32" | "i32" | "f32" | "bigint128";
export type ColValue = Uint32Array | Int32Array | Float32Array | bigint[];

interface ColumnHeader {
  name: string;
  kind: ColKind;
  count: number;
}

interface TableHeader {
  columns: ColumnHeader[];
  pools: Record<string, string[]>;
}

const BYTES_PER: Record<ColKind, number> = { u32: 4, i32: 4, f32: 4, bigint128: 16 };

function kindOf(value: ColValue): ColKind {
  if (Array.isArray(value)) return "bigint128";
  if (value instanceof Uint32Array) return "u32";
  if (value instanceof Int32Array) return "i32";
  return "f32";
}

function encodeBigints(values: bigint[]): Buffer {
  const buf = Buffer.alloc(values.length * 16);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? 0n;
    view.setBigUint64(i * 16, v >> 64n, false);
    view.setBigUint64(i * 16 + 8, v & 0xffffffffffffffffn, false);
  }
  return buf;
}

// Uint32Array/Int32Array/Float32Array constructors require their byteOffset to
// be a multiple of the element size. gunzipSync always hands back a freshly
// allocated, zero-offset Buffer in practice, so this never actually copies —
// it's a defensive fallback, not the expected path.
function typedView<T extends Uint32Array | Int32Array | Float32Array>(
  Ctor: new (buffer: ArrayBufferLike, byteOffset: number, length: number) => T,
  bytesPerElement: number,
  buf: Buffer,
  offset: number,
  count: number,
): T {
  const absOffset = buf.byteOffset + offset;
  if (absOffset % bytesPerElement === 0) {
    return new Ctor(buf.buffer, absOffset, count);
  }
  const copy = Buffer.from(buf.subarray(offset, offset + count * bytesPerElement));
  return new Ctor(copy.buffer, copy.byteOffset, count);
}

function decodeBigints(view: DataView, byteOffset: number, count: number): bigint[] {
  const out: bigint[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const hi = view.getBigUint64(byteOffset + i * 16, false);
    const lo = view.getBigUint64(byteOffset + i * 16 + 8, false);
    out[i] = (hi << 64n) | lo;
  }
  return out;
}

/** Writes a set of typed-array/bigint columns + string pools as one gzipped binary file. */
export function writeTable(
  path: string,
  columns: Record<string, ColValue>,
  pools: Record<string, string[]>,
): void {
  const headerCols: ColumnHeader[] = [];
  const bodies: Buffer[] = [];
  for (const [name, value] of Object.entries(columns)) {
    const kind = kindOf(value);
    headerCols.push({ name, kind, count: value.length });
    bodies.push(
      Array.isArray(value)
        ? encodeBigints(value)
        : Buffer.from(value.buffer, value.byteOffset, value.byteLength),
    );
  }

  const header: TableHeader = { columns: headerCols, pools };
  const headerJson = Buffer.from(JSON.stringify(header), "utf8");
  const headerLenBuf = Buffer.alloc(4);
  headerLenBuf.writeUInt32LE(headerJson.byteLength, 0);
  // Pad so every column body starts 4-byte aligned (u32/i32/f32 views require it).
  const preBodyLen = 4 + headerJson.byteLength;
  const padding = Buffer.alloc((4 - (preBodyLen % 4)) % 4);

  writeFileSync(path, gzipSync(Buffer.concat([headerLenBuf, headerJson, padding, ...bodies])));
}

/** Reads a file written by {@link writeTable} back into typed-array columns. */
export function readTable(path: string): {
  columns: Record<string, ColValue>;
  pools: Record<string, string[]>;
} {
  const buf = gunzipSync(readFileSync(path));
  const headerLen = buf.readUInt32LE(0);
  const header = JSON.parse(buf.subarray(4, 4 + headerLen).toString("utf8")) as TableHeader;
  const preBodyLen = 4 + headerLen;
  let offset = preBodyLen + ((4 - (preBodyLen % 4)) % 4);

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const columns: Record<string, ColValue> = {};
  for (const col of header.columns) {
    const byteLen = col.count * BYTES_PER[col.kind];
    if (col.kind === "bigint128") {
      columns[col.name] = decodeBigints(view, offset, col.count);
    } else if (col.kind === "u32") {
      columns[col.name] = typedView(Uint32Array, 4, buf, offset, col.count);
    } else if (col.kind === "i32") {
      columns[col.name] = typedView(Int32Array, 4, buf, offset, col.count);
    } else {
      columns[col.name] = typedView(Float32Array, 4, buf, offset, col.count);
    }
    offset += byteLen;
  }
  return { columns, pools: header.pools };
}
