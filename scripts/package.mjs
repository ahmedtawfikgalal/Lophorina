// Builds the store zip from dist/ (run `npm run package`, which builds first).
// Minimal zip writer on node:zlib, so packaging needs no extra dependency.
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const { version } = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

// Source maps are for development; the store package does not need them.
const entries = files(dist).filter((f) => !f.endsWith('.map'));
const locals = [];
const centrals = [];
let offset = 0;
for (const file of entries) {
  const name = Buffer.from(relative(dist, file).split(sep).join('/'));
  const data = readFileSync(file);
  const packed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const header = (sig, extra) => {
    const b = Buffer.alloc(extra ? 46 : 30);
    b.writeUInt32LE(sig, 0);
    let o = 4;
    if (extra) {
      b.writeUInt16LE(20, o); // version made by
      o += 2;
    }
    b.writeUInt16LE(20, o); // version needed
    b.writeUInt16LE(0, o + 2); // flags
    b.writeUInt16LE(8, o + 4); // deflate
    b.writeUInt32LE(0, o + 6); // time/date (zeroed: reproducible)
    b.writeUInt32LE(crc, o + 10);
    b.writeUInt32LE(packed.length, o + 14);
    b.writeUInt32LE(data.length, o + 18);
    b.writeUInt16LE(name.length, o + 22);
    if (extra) b.writeUInt32LE(offset, 42); // local header offset
    return b;
  };
  const local = Buffer.concat([header(0x04034b50, false), name, packed]);
  centrals.push(Buffer.concat([header(0x02014b50, true), name]));
  locals.push(local);
  offset += local.length;
}
const central = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(offset, 16);

mkdirSync(join(root, 'release'), { recursive: true });
const out = join(root, 'release', `lophorina-${version}.zip`);
writeFileSync(out, Buffer.concat([...locals, central, end]));
console.log(
  `${relative(root, out)}: ${entries.length} files, ${(statSync(out).size / 1e6).toFixed(1)} MB`,
);
