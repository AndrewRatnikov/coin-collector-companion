// packages/shared has "type": "module" (it's built to real ESM in production, consumed
// fine at runtime by Node's native require(esm) support — see CLAUDE.md 4.2 notes). Jest's
// CJS-based runtime can't execute that ESM output directly, and routing these files through
// the project's own ts-jest config still emits ESM (NodeNext honors the package's own
// package.json "type" field, not the consumer's). This transformer forces a plain CommonJS
// transpile of packages/shared's sources for tests only; nothing here touches the real build.
const ts = require('typescript');

module.exports = {
  process(sourceText, sourcePath) {
    const { outputText, sourceMapText } = ts.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    return { code: outputText, map: sourceMapText };
  },
};
