import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const MiB = 1024 ** 2;
const limits = { compressed: 32 * MiB, extracted: 64 * MiB, file: 8 * MiB, entries: 2000, path: 4096, padding: MiB };
const block = 512;
// Bound memory separately from the extracted-file quota: tar headers, per-file
// alignment, extended path records and end padding are not extracted files.
const maxTar = limits.extracted + (16 * 1024 * limits.entries) + limits.padding;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const fail = (message) => { throw new Error(message); };
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function stringField(bytes) {
  const end = bytes.indexOf(0);
  return utf8.decode(end === -1 ? bytes : bytes.subarray(0, end));
}
function octal(bytes) {
  const str = stringField(bytes).trim();
  if (!/^[0-7]+$/.test(str)) fail('Invalid tar numeric field');
  return Number.parseInt(str, 8);
}
function parsePax(bytes) {
  const values = new Map();
  for (let i = 0; i < bytes.length;) {
    const space = bytes.indexOf(32, i);
    const length = space === -1 ? '' : bytes.toString('ascii', i, space);
    if (!/^[1-9]\d*$/.test(length)) fail('Invalid PAX record length');
    const end = i + Number(length);
    if (end <= space + 2 || end > bytes.length || bytes[end - 1] !== 10) fail('Invalid PAX record');
    const eq = bytes.indexOf(61, space + 1);
    if (eq <= space + 1 || eq >= end - 1) fail('Invalid PAX field');
    const key = utf8.decode(bytes.subarray(space + 1, eq));
    if (/^(?:GNU\.sparse|SCHILY\.(?:filetype|linkpath|realsize))/.test(key) || key === 'linkpath') fail(`Unsupported PAX field: ${key}`);
    if (key === 'path' || key === 'size') {
      if (values.has(key)) fail(`Duplicate PAX field: ${key}`);
      values.set(key, utf8.decode(bytes.subarray(eq + 1, end - 1)));
    }
    i = end;
  }
  return values;
}

function cleanPath(raw, directory) {
  if (Buffer.byteLength(raw) > limits.path || raw.startsWith('/') || raw.includes('\\') || raw.includes('\0')) fail(`Unsafe tar path: ${JSON.stringify(raw)}`);
  const stripped = raw.replace(/^(?:\.\/)+/, '');
  const parts = (directory ? stripped.replace(/\/+$/, '') : stripped).split('/');
  if (directory && (parts[0] === '.' || parts[0] === '') && parts.length === 1) return '';
  if (parts.some((part) => !part || part === '.' || part === '..' || /^[A-Za-z]:/.test(part))) fail(`Unsafe tar path: ${JSON.stringify(raw)}`);
  if (parts.some((part) => part.startsWith('._'))) fail(`AppleDouble file in tar: ${JSON.stringify(raw)}`);
  return parts.join('/');
}

function archiveEntries(archive) {
  const info = statSync(archive);
  if (!info.isFile() || info.size > limits.compressed) fail('Package must be a regular file no larger than 32 MiB');
  const tar = gunzipSync(readFileSync(archive), { maxOutputLength: maxTar });
  const entries = new Map();
  let payloadBytes = 0;
  let offset = 0;
  let pending;
  let finished = false;
  let sawRoot = false;
  const checkEntryCount = () => {
    if (entries.size + Number(sawRoot) > limits.entries) fail('Archive exceeds 2000 entries (including implicit directories)');
  };
  const put = (path, entry) => {
    entries.set(path, entry);
    checkEntryCount();
  };
  while (offset + block <= tar.length) {
    const header = tar.subarray(offset, offset + block);
    if (header.every((byte) => byte === 0)) {
      const padding = tar.subarray(offset);
      if (pending || padding.length < 2 * block || padding.length - 2 * block > limits.padding || !padding.every((byte) => byte === 0)) {
        fail('Invalid tar end or padding');
      }
      finished = true;
      break;
    }
    const checksum = header.reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
    if (checksum !== octal(header.subarray(148, 156))) fail('Invalid tar header checksum');
    const type = header[156];
    const extended = type === 120 || type === 76; // per-entry POSIX PAX or GNU long name
    const directory = type === 53;
    if (!extended && !directory && type !== 0 && type !== 48) fail(`Unsupported tar entry type: ${JSON.stringify(String.fromCharCode(type))}; only regular files and directories are allowed`);
    const paxSize = extended ? undefined : pending?.get('size');
    if (paxSize !== undefined && !/^\d+$/.test(paxSize)) fail('Invalid PAX size');
    const size = paxSize === undefined ? octal(header.subarray(124, 136)) : Number(paxSize);
    if (!Number.isSafeInteger(size) || size > limits.file) fail('Tar entry exceeds 8 MiB');
    const dataStart = offset + block;
    offset = dataStart + Math.ceil(size / block) * block;
    if (offset > tar.length) fail('Truncated tar entry');
    const bytes = tar.subarray(dataStart, dataStart + size);
    if (extended) {
      if (pending || size > 16 * 1024) fail('Unexpected or oversized extended tar header');
      pending = type === 120 ? parsePax(bytes) : new Map([['path', stringField(bytes)]]);
      continue;
    }
    if (directory && size) fail('Tar directory has a payload');
    const prefix = header.subarray(257, 263).equals(Buffer.from('ustar\0')) ? stringField(header.subarray(345, 500)) : '';
    const path = cleanPath(pending?.get('path') ?? `${prefix ? `${prefix}/` : ''}${stringField(header.subarray(0, 100))}`, directory);
    pending = undefined;
    if (!path) {
      if (sawRoot) fail('Duplicate tar root directory');
      sawRoot = true;
      checkEntryCount();
      continue;
    }
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/');
      const previous = entries.get(parent);
      if (previous && !previous.directory) fail(`Parent is not a directory: ${parent}`);
      if (!previous) put(parent, { directory: true, implicit: true });
    }
    const previous = entries.get(path);
    if (previous && !(directory && previous.implicit)) fail(`Duplicate or conflicting tar entry: ${path}`);
    payloadBytes += size;
    if (payloadBytes > limits.extracted) fail('Archive exceeds 64 MiB when extracted');
    put(path, { directory, bytes });
  }
  if (!finished) fail('Missing tar end marker');
  for (const name of ['dist/index.html', 'theme.json', 'preview.png']) {
    if (!entries.has(name) || entries.get(name).directory) fail(`Missing regular file: ${name}`);
  }
  return entries;
}

function validateManifest(manifest) {
  if (!isObject(manifest)) fail('theme.json must contain an object');
  for (const key of ['name', 'short', 'description', 'version', 'author', 'url']) {
    if (typeof manifest[key] !== 'string') fail(`theme.json: ${key} must be a string`);
  }
  if (!manifest.name.trim()) fail('theme.json: name must not be empty');
  if (!/^[A-Za-z0-9_-]+$/.test(manifest.short)) fail('theme.json: short may only contain A–Z, a–z, 0–9, _ and -');
  if (!Object.hasOwn(manifest, 'config')) return;
  if (!Array.isArray(manifest.config)) fail('theme.json: config must be an array');
  const keys = new Set();
  for (const [i, field] of manifest.config.entries()) {
    const check = (condition, message) => { if (!condition) fail(`theme.json: config[${i}]: ${message}`); };
    check(isObject(field), 'must be an object');
    if (field.type === 'title') {
      check(typeof field.label === 'string' && Object.keys(field).length === 2, 'title must have only type and a string label');
      continue;
    }
    check(typeof field.key === 'string' && field.key.trim(), 'key must be a non-empty string');
    check(!keys.has(field.key), `duplicate key: ${field.key}`);
    keys.add(field.key);
    for (const key of ['label', 'help']) {
      check(!Object.hasOwn(field, key) || typeof field[key] === 'string', `${key} must be a string when present`);
    }
    switch (field.type) {
      case 'string':
      case 'text': check(typeof field.default === 'string', 'default must be a string'); break;
      case 'boolean': check(typeof field.default === 'boolean', 'default must be a boolean'); break;
      case 'number': {
        check(Number.isFinite(field.default), 'default must be a finite number');
        for (const key of ['min', 'max']) {
          check(!Object.hasOwn(field, key) || Number.isFinite(field[key]), `${key} must be a finite number when present`);
        }
        check((field.min ?? -Infinity) <= field.default && field.default <= (field.max ?? Infinity), 'expected min ≤ default ≤ max');
        break;
      }
      case 'select': {
        check(Array.isArray(field.options) && field.options.length > 0, 'select needs at least one option');
        for (const option of field.options) {
          check(isObject(option) && typeof option.value === 'string' && option.value.length > 0, 'options need a non-empty string value');
          check(!Object.hasOwn(option, 'label') || typeof option.label === 'string', 'option label must be a string when present');
        }
        check(typeof field.default === 'string' && field.options.some((option) => option.value === field.default), 'default must match an option value');
        break;
      }
      default: check(false, `unknown type: ${field.type}`);
    }
  }
}

try {
  const args = process.argv.slice(2);
  const limitsOnly = args[0] === '--limits-only';
  if (limitsOnly) args.shift();
  if (args.length > 1 || args[0]?.startsWith('--')) fail('usage: verify-package.mjs [--limits-only] [theme.tar.gz]');
  const archive = args[0] ?? 'theme.tar.gz';
  const entries = archiveEntries(archive);
  if (!limitsOnly) {
    const tmp = mkdtempSync(join(tmpdir(), 'dys-theme-'));
    try {
      // Extract only already validated paths and regular files (no system-tar
      // reinterpretation of extensions, modes, or pathname conflicts).
      for (const [path, entry] of entries) {
        const target = join(tmp, path);
        mkdirSync(entry.directory ? target : dirname(target), { recursive: true });
        if (!entry.directory) writeFileSync(target, entry.bytes, { flag: 'wx' });
      }
      validateManifest(JSON.parse(readFileSync(join(tmp, 'theme.json'), 'utf8')));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  console.log(`${archive}: ${entries.size} entries, limits OK${limitsOnly ? '' : ', theme.json OK'}`);
} catch (err) {
  console.error(`Invalid theme package: ${err.message}`);
  process.exitCode = 1;
}
