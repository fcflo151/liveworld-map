import { readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'src/components');
const cachePrefix = process.argv[3] ?? 'components';
const eslintBin = resolve('node_modules/eslint/bin/eslint.js');
const MAX_FILES_PER_CHUNK = 5;
const MAX_SOURCE_BYTES_PER_CHUNK = 90_000;
const ESLINT_HEAP_MB = 6144;

function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(?:js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = collectSourceFiles(root)
  .map(path => ({ path, bytes: statSync(path).size }))
  .sort((a, b) => a.path.localeCompare(b.path));

if (files.length === 0) {
  console.log(`[eslint-chunks] No source files found under ${relative(process.cwd(), root)}`);
  process.exit(0);
}

const chunks = [];
let current = [];
let currentBytes = 0;

for (const file of files) {
  const oversized = file.bytes >= MAX_SOURCE_BYTES_PER_CHUNK;
  const wouldOverflow = current.length >= MAX_FILES_PER_CHUNK || currentBytes + file.bytes > MAX_SOURCE_BYTES_PER_CHUNK;

  if (current.length && (oversized || wouldOverflow)) {
    chunks.push(current);
    current = [];
    currentBytes = 0;
  }

  current.push(file);
  currentBytes += file.bytes;

  // Very large renderer/components get a dedicated ESLint process so their
  // TypeScript/React analysis cannot retain the rest of the component tree.
  if (oversized) {
    chunks.push(current);
    current = [];
    currentBytes = 0;
  }
}
if (current.length) chunks.push(current);

console.log(`[eslint-chunks] ${files.length} files in ${chunks.length} bounded processes`);

for (const [index, chunk] of chunks.entries()) {
  const names = chunk.map(file => relative(process.cwd(), file.path));
  const cacheLocation = `.cache/eslint/${cachePrefix}-${index + 1}`;
  console.log(`[eslint-chunks] ${index + 1}/${chunks.length}: ${names.join(', ')}`);

  const result = spawnSync(
    process.execPath,
    [
      `--max-old-space-size=${ESLINT_HEAP_MB}`,
      eslintBin,
      ...names,
      '--cache',
      '--cache-strategy', 'content',
      '--cache-location', cacheLocation,
    ],
    { stdio: 'inherit' },
  );

  if (result.error) {
    console.error(`[eslint-chunks] Failed to start ESLint: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
