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

`tests/web/` owns the Web suites, setup, Jest selection, and ESLint wrapper.
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

`deadline.spec.tsx` adds eight deadline/recovery cases with the actual provider
and custom RPC wrapper. A missing official or custom reply leaves Loading at
five seconds with reconnect guidance. Refresh does not queue more calls on the
timed-out connection; late success/error cannot restore it. A new connection
recovers. Secured-read rejection and malformed-module recovery remain positive
controls. Connection/index retirement and unmount clear their owned deadline
without affecting a replacement load. `deadline-stream.spec.tsx` adds one case
using the actual SDK global mutex and real Web Streams: the timed-out read
still owns its reader, retries do not enqueue, and a controlled disconnection
followed by a replacement stream recovers. This does not establish physical
transport cancellation or acceptance. All fifteen prior scenarios remain.

The dispatcher generates the real owner schema and runs each scenario once.
`bash tests/run-web.sh --coverage` adds coverage without changing selection.
Run `npm run build` and `npm run lint` in `web/` for source and owner fixture
checks. Mocked client/DOM observations do not establish browser serial delivery,
real keyboard geometry, reconnect behavior, or physical acceptance.

`response.spec.tsx` adds twenty-two cases: twenty invalid payload/envelope or
geometry cases retain a loaded layout and recover on the same connection, and
one independent geometry case covers every module family, disabled encoder
indexes, signed coordinates, rotated bounds, centi-degree transforms and links.
The twenty invalid cases fail against the original app; the geometry control
passes. An explicitly empty success clears the layout after recovery. All
twenty-four earlier Web cases remain selected.
The additional duplicate-identifier case reproduces stale SVG/list entries when
same-named nodes from different families are followed by a valid reduced layout.
The original app reports one module while retaining two SVG shapes. Rejecting
the duplicate response preserves wire identifiers and lets a subsequent valid
refresh remove the old layout normally.

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
process exits, sanitizer diagnostics, fatal assertions and every linked checked-init
result before comparing unchanged owner snapshots. Recovering ASan/UBSan findings
reject the clean gate even when the process exits zero and completes its snapshot;
raw process and verifier results remain separate observations. A SYS_INIT error cannot be hidden by a
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

Response construction fills the already-cleared DYA response buffer directly.
The existing malformed/unsupported dispatch and recovery assertions cover both
union alternatives after repeated allocation. The serialized schema, fixed
string capacities, callback arguments, device order and security policy remain
unchanged. ARM compiler frames and linked memory are separate measurements;
neither a compiler frame nor a native trace establishes physical stack high-water.

With no arguments, fail-fast selection runs sanitized root, nested and signed
int32/dimension boundary layouts, each built once and executed three times;
full mode then adds the same three optimized layouts with three repetitions.
The boundary layout independently decodes `INT32_MIN`/`INT32_MAX` coordinates and
positive dimensions of `1`/`INT32_MAX`. Eighteen compile-refusal controls cover
zero, negative and greater-than-int32 dimensions for trackball size, encoder
size, and both rectangle dimensions. Each requires the exact
`physical layout dimensions must be positive int32 values` assertion; an
unrelated compiler failure does not qualify. The original handler compiles the
first zero-size control, so the refusal check fails against that original.
The oversized-name compile-refusal control remains last in both modes.

For retained evidence, select a fresh absolute directory outside the owner and
any selected handler source checkout:

```bash
ZMK_TEST_MODE=full python3 tests/protocol/run.py --output "$EVIDENCE/protocol"
python3 tests/protocol/run.py --source "$FAULT_HANDLER" \
  --variant sanitized-nested --output "$EVIDENCE/focused-protocol"
```

`--variant` accepts `all` (default), `sanitized-root`, `sanitized-nested`,
`sanitized-boundary`, `optimized-root`, `optimized-nested`,
`optimized-boundary`, `invalid-dimensions`, or `oversized`. A focused runtime variant runs its
unchanged flags and all three repetitions, even when the selected optimization
would not be in quick mode; `oversized` runs only the original compile-refusal
assertion. Focused output and `results.json` explicitly state that the canonical
full matrix was not run. Focused success cannot replace a complete owner run.
`invalid-dimensions` runs only the eighteen specified compile-refusal controls.
The canonical owner entry passes its fresh `OWNER_TEST_OUTPUT/protocol` path to
this runner and requires all eight full-mode variant completions, retaining the
actual binaries, generated schema and per-command logs.

`--output` retains source/fixture/proto/dependency input copies and SHA-256s,
generated headers/code and copied generator, the actual binaries and SHA-256s,
exact commands, compiler identity, process exits, durations, compile/run logs,
working directories and selected inherited environment values. Other environment
values are omitted, with a hash of the inherited environment for identity.
`results.json` is written before every command and on failure, including partial
progress and input drift; source inputs must remain unchanged. An assertion or
compiler failure leaves the already-built binary and its logs available without
changing the original fail-fast behavior. Without `--output`, temporary files
retain their original automatic cleanup. Evidence includes actual local paths;
review and sanitize a separate publication copy before external sharing.
The existing `tests/protocol/negative.py --output FRESH_DIRECTORY` now passes a
fresh retained directory to each unchanged baseline/fault invocation. It keeps
the original case order, quick selection and detection assertions.

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
owns fourteen real-ELF admission controls, retaining the eleven previous cases
and adding real recovering ASan output on stdout, real recovering UBSan output
on stderr, and a positive case with harmless sanitizer hook names/options.
The original verifier accepts both diagnosed binaries three times with zero
process exits, successful checked initialization and matching snapshots; the two
new rejection assertions fail specifically with `AssertionError not raised`.

To reproduce that named original control without modifying this checkout:

```sh
python3 tests/native_verifier_negative.py --verifier "$ISOLATED_ORIGINAL_VERIFIER" \
  --output "$FRESH_ABSOLUTE_EVIDENCE"
```

The operator requires exactly those two assertion failures among all fourteen
cases, twelve positive completions, zero errors/skips and six diagnosed,
zero-exit runs. Its exit remains one to preserve the actual failing-suite status;
`result.json` separately records qualification. `NATIVE_VERIFIER_CONTROL_OUTPUT`
retains current admission fixtures, compiler commands, original C/ELF bytes and
raw run records when running the normal owner entry.

Native ASan-only and optimized lanes can establish their own clean results.
At the selected DYA pin, strict ASan/UBSan may stop at
`app/module/drivers/kscan/kscan_mock.c:103` (`1 << 31`). The recovering combined
lane can complete the same snapshot while still reporting undefined behavior;
both combined clean gates remain BLOCKED. Keep every raw diagnostic, actual
process exit, source hash and ownership classification, and distinguish direct
three-trial observations from a verifier group that rejects its first finding.
Strict combined builds require `CONFIG_ASAN_RECOVER=n` and, at this Zephyr pin,
`-DEXTRA_CFLAGS=-fno-sanitize-recover=all` for owner/Zephyr objects; the Kconfig
switch alone does not add the strict flag. Verify the actual final compiler
flags because a later recovery flag overrides an earlier strict flag.
The separately compiled NSI host runner does not inherit `EXTRA_CFLAGS`;
retain its `nsi_config`, original Make dependency files and compiler options.
The strict lane also sets `UBSAN_OPTIONS=halt_on_error=1`, including for NSI;
do not extend the owner/Zephyr compiler-flag claim to that host runner.
The standalone protocol sanitizer profile already uses
`-fsanitize=address,undefined -fno-sanitize-recover=all`; it does not declare a
recovering runtime profile.

`bash tests/run-web.sh` is the canonical schema-generation/Web test entry.
It runs all configured Jest scenarios in one worker process. The pre-commit
Jest hook dispatches this same owner entry so nested workers do not multiply
the global container budget. Build and lint retain their separate package entries.

## Review regressions

The protocol entry retains all prior assertions and adds a grouped-node DT
variant for every family, links and disabled nodes. Optimized and ASan/UBSan
binaries each execute three times without rebuilding. The `nested devices omitted`
source fault restores the root-only trackball encoder and must fail the same
assertions after successful compilation. It restores both the matching link
encoder definition and device enumeration, so grouped nodes do not leave an
unused link function under the unchanged `-Werror` flags. The other four source
faults and the five-case order remain unchanged; every replacement must match
exactly once. `tests/nested` builds the same handler
with actual grouped Devicetree nodes and retains the Studio registration snapshot.
The peripheral board variant requests the unavailable RPC option with Kconfig
warnings nonfatal for that target only, and requires the resolved module option
to be disabled; all three original board variants remain unchanged.

The native grouped fixture validates actual DTS binding/handler compilation and
subsystem registration. The host protocol fixture validates the exact serialized
data separately with controlled DT accessors. Neither verifies that multiple
encoder bundles correspond to a keyboard's official sensor indexes; installation
must keep a single bundle's phandle order aligned with `zmk,keymap-sensors`.
