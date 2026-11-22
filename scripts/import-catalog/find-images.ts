import { readFileSync, writeFileSync } from 'node:fs';

import { runFindImages } from './lib/find-images';
import type { FetchLike } from './lib/generate';

// Entry point of `pnpm run find-images` (see README.md, "Finding images"). It only wires
// real dependencies into runFindImages; all logic lives in lib/find-images.ts.

runFindImages(process.argv.slice(2), {
  fetch: ((url, init) => fetch(url, init)) as FetchLike,
  baseDir: __dirname,
  contact: process.env.WIKIPEDIA_CONTACT,
  readFile: (path) => readFileSync(path, 'utf8'),
  writeFile: (path, contents) => writeFileSync(path, contents),
  log: (line) => console.log(line),
  error: (line) => console.error(line),
})
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
