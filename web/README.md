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

Review the full development graph with `npm audit` as well. Compatible locked
transitive updates remove the reported high/critical development findings without
changing direct requirements, the Vite alias, Git SDK/React hook revisions or
`protobufjs` 7.6.5. The retained development graph still reports 18 findings
(14 moderate and four low); the full audit remains FAIL. The production-only
audit reports zero findings. Do not use forced upgrades or proposed major
version downgrades merely to obtain a clean development audit.

After a lock update, use a clean `npm ci` with its normal package lifecycles, then
run the complete owner Web suites, lint and production build. The declared
workflows use Node 22.23.4 and Node 24.18.0; verify both environments. Unit/DOM
checks do not establish real browser or keyboard transport acceptance.

This app has no SDK console-suppression plugin or runtime wrapper. The pinned
SDK can log a closed request pipeline, and its React hook can log connection or
notification errors. Existing source/stream tests keep those actual SDK paths;
there is no suppression-site guard or suppression guarantee.
