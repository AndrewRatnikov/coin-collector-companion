import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { runGenerate } from './lib/generate';
import type { FetchLike } from './lib/generate';

// Entry point of `pnpm run generate` (see README.md, "Generating a fixture"). It only
// wires real dependencies into runGenerate; all logic lives in lib/generate.ts.

runGenerate(process.argv.slice(2), {
  fetch: ((url, init) => fetch(url, init)) as FetchLike,
  today: () => new Date().toISOString().slice(0, 10),
  baseDir: __dirname,
  contact: process.env.WIKIPEDIA_CONTACT,
  writeFile: (path, contents) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  },
  log: (line) => console.log(line),
  error: (line) => console.error(line),
})
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
