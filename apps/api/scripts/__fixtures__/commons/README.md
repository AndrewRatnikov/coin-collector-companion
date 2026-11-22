# Commons test fixtures

Responses used by the `import-catalog-*.spec.ts` specs of `find-images`. The specs never call the network: a fake `fetch` serves these files.

- `categorymembers-root.json`, `categorymembers-root-continued.json`, `categorymembers-subcategory.json`: `action=query&list=categorymembers&formatversion=2` pages for `Category:Coins of Ukraine` (first page with a `continue` object, then the continuation) and for `Category:10 hryvnias coins of Ukraine`. The subcategory also lists the root category again, to exercise cycle handling, and one file that is also in the root.
- `imageinfo.json`: `prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=500` page objects for the files above, in the real response shape (`extmetadata` fields as `{ "value": ... }`). The fake `fetch` returns the pages whose titles were asked for. It includes a public-domain reverse, an obverse, two equal reverses (an ambiguous pair), a CC BY-SA file (rejected by the gate), a file with only a `Credit`, a side-by-side composite (2:1) and a deleted file.
- `fixture-ukraine-sample.json`: a small Ukrainian fixture in the layout of `scripts/import-catalog/fixtures/`, with `4.0` and `3.0` numbers that `JSON.stringify` would rewrite, a `titleUk`, and one coin that already has an `image`.

The files are trimmed and hand-edited to the shape of real Commons API output, not captured from a live run (no network access in the test environment). They carry invented file names and creators, only the structure is real.
