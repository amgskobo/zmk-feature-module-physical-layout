# Owner tests

This repository owns its executable test logic and fixtures under `tests/`.

## Current test ownership and compatibility

This owner supports DYA custom Studio RPC. Stock ZMK is NOT APPLICABLE;
no feature-disabled stock check is required or counted as compatibility.

Canonical entries (run from the repository root):

```bash
python3 -m unittest discover -v -s tests -p test_owner.py
bash tests/run-web.sh
```

## Web protocol and rendering boundary

`tests/web/` owns the two Web suites, setup, Jest selection, and ESLint wrapper.
`App.spec.tsx` retains four scenarios for the header, disconnected connection
control, footer, and connection action. `PhysicalLayoutSection.spec.tsx` retains
five scenarios for layout controls, loaded key/module counts, one automatic load
when subsystem objects change identity, a missing-subsystem warning, and absent
application context. These are the nine pre-relocation scenarios; the latter suite was
previously named `web/test/RPCTestSection.spec.tsx`.

`lifecycle.spec.tsx` adds six scenarios with the actual provider, generated
response schema and deferred SDK replies. Old-connection success and error may
not replace a newly loaded layout; an old completion may not clear a new
connection's loading state; an unmounted request is retired. Subsystem-index-only
replacement also retires old success/error on the same connection. Five cases
fail against the archived pre-repair app; the unmount control passes. The
original nine scenarios remain.

The dispatcher generates the real owner schema and runs each scenario once.
`bash tests/run-web.sh --coverage` adds coverage without changing selection.
Run `npm run build` and `npm run lint` in `web/` for source and owner fixture
checks. Mocked client/DOM observations do not establish browser serial delivery,
real keyboard geometry, reconnect behavior, or physical acceptance.

[maintenance.json](maintenance.json) records supported cores, current commands
and explicit gaps. It is a reference map, not a passing test or a claim that
registration/coverage totals establish completeness. Preserve ordered outputs,
raw timestamps and the first failure. Read actual dependencies before execution.

`OWNER_TEST_OUTPUT=/absolute/new/directory` retains owner native/build outputs.
An existing directory fails before tests. Without it a fresh temporary directory
is printed and retained. No shared build directory is deleted. Use
`PYTHONPATH=tests python3 -m unittest -v test_owner.WestCommandsTests.<method>`
for a focused case; discovery runs the complete documented class.

The native verifier runs each built binary three times in independent empty
initial-flash directories, retaining raw output before filtering. It checks real
process exits, fatal assertions and every linked checked-init result before
comparing unchanged owner snapshots. A SYS_INIT error cannot be hidden by a
later matching key trace. Native scheduling and controlled APIs still do not
establish physical transport/retention. Test-only core/tool dependencies are
pinned; update pins only after reviewing the new sources and rerunning this
owner matrix. No network updates are implicit in the owner test command.

## Serialized protocol boundary

```bash
python3 tests/protocol/run.py
```

This compiles the complete production handler with the owner-generated schema
and real nanopb under sanitizers and optimization. Set `NANOPB_SOURCE` to the
explicitly inspected nanopb checkout (physical-layout also needs `ZEPHYR_BASE`).
It checks malformed/unsupported/valid dispatch and recovery, exact response
fields and presence, repeated callback order, two-pass encoded size and failure
at every insufficient output capacity. Framework APIs are controlled; no core
source is patched. This complements registration/native and board checks. A
fixture display-name longer than its 64-byte message field must fail to build.
The runner is also `test_owner.WestCommandsTests.test_protocol`.

## Reproducible isolated checks

Use this owner's `west/west-test-isolated.yml` and its pinned test dependency
manifest. Test ZMK is `e5c9b6915b56801193e359dd9bad4a167ce0d1b8`;
Zephyr is `10ba6d0cb38bc3d258775d27982f707599320085`. Resolve the
manifest and verify actual checkout identities before running. Do not inherit
global CMake module overrides or moving production dependency references into
these isolated fixtures. The CI SDK image is pinned by digest in
`.github/workflows/zmk-module.yml`; production dependency manifests are separate.

Use a new `OWNER_TEST_OUTPUT` directory for every complete owner run. Native
repeats reuse one compiled binary with independent initial-flash state; keep
the first failure and raw combined stdout/stderr order. DYA-only compatibility
still means no stock-ZMK test requirement.

The test/tool static CI job installs pre-commit 4.7.0 and uses the pinned
Ruff/clang-format/formatting hooks. Its SKIP list avoids repeating the firmware
and Web jobs. Local full pre-commit execution may run those functional hooks;
prepare Web dependencies with the normal package lifecycle first where present.
A successful hook exit must also leave source inputs unchanged. Snapshot and
event-pattern bytes are excluded from whitespace rewriting.

The owner command boundary limits `zmk-build` to one target at a time by
default. `OWNER_TEST_BUILD_PARALLELISM` selects an explicit positive target
count; account for compiler jobs and concurrent owners in the global budget.
`tests/test_build_budget.py` checks default/explicit forwarding and rejects
invalid budgets before launching west. The canonical owner entry includes
these controls without dropping any native or board scenario.

Native result admission requires every `native_sim.keymap` fixture to have a
matching binary. `required_hooks.json` names the expected checked initialization
hooks and required feature/role configuration. Fixture-bound declarations also
reject missing configuration when both the request and build omit it; excluded
roles cannot replace the requested role. The verifier retains all three raw
runs before comparing unchanged ordered snapshots and rejects logged failures,
fatal output and missing/nonzero completions. `tests/test_native_verifier.py`
owns eleven real-ELF admission controls, including a deliberately missing
native scenario, wrong-role and unrelated-fixture controls.

`bash tests/run-web.sh` is the canonical schema-generation/Web test entry.
It runs all configured Jest scenarios in one worker process. The pre-commit
Jest hook dispatches this same owner entry so nested workers do not multiply
the global container budget. Build and lint retain their separate package entries.
