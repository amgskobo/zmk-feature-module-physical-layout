# Physical Layout Web UI

This React app connects to ZMK Studio, calls the `cormoran__physical_layouts` custom RPC subsystem, and renders non-key physical modules together with ZMK's official key physical layout data.

## Commands

```sh
npm install
npm run generate
npm test
npm run dev
```

The canonical owner entry from the repository root is `bash tests/run-web.sh`.
Executable assertions, setup, and Jest configuration live in `tests/web/`.
`npm test` generates the current protobuf types before dispatching that suite.

The protobuf schema is defined in:

```text
../proto/zmk/physical_layouts/physical_layouts.proto
```

Generated TypeScript output is written under:

```text
src/proto/zmk/physical_layouts/
```

## Dependency security

`package.json` overrides the Studio client's transitive `protobufjs` dependency
to `7.6.5`, including the patched UTF-8 helper. Use `npm ci` with this lockfile.
After changing dependencies, run `npm audit --omit=dev`, the Web tests and the
production build.
