#!/usr/bin/env python3
"""Run the owner's admission controls against an isolated original verifier."""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "test_recovering_undefined_sanitizer_cannot_pass_with_zero_exit",
    "test_recovering_address_sanitizer_stdout_cannot_pass_with_zero_exit",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verifier", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    verifier = args.verifier.resolve(strict=True)
    output = args.output.resolve()
    if verifier.is_relative_to(ROOT):
        parser.error("select an isolated original verifier outside this checkout")
    if (
        not args.output.is_absolute()
        or args.output.exists()
        or args.output.is_symlink()
    ):
        parser.error("output must be a fresh absolute path")
    output.mkdir(parents=True, exist_ok=False)
    os.environ["NATIVE_VERIFIER_CONTROL_OUTPUT"] = str(output / "fixtures")
    spec = importlib.util.spec_from_file_location("native_verifier", verifier)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    sys.path.insert(0, str(ROOT / "tests"))
    from test_native_verifier import NativeVerifierContract

    result = unittest.TextTestRunner(verbosity=2).run(
        unittest.defaultTestLoader.loadTestsFromTestCase(NativeVerifierContract)
    )
    qualified = (
        result.testsRun == 14
        and len(result.failures) == 2
        and {test._testMethodName for test, _ in result.failures} == EXPECTED
        and all("AssertionError not raised" in trace for _, trace in result.failures)
        and not result.errors
        and not result.skipped
        and not result.expectedFailures
        and not result.unexpectedSuccesses
    )
    actual_diagnostics = []
    for name in sorted(EXPECTED):
        runs = output / "fixtures" / name / "build/case/verified-runs"
        expected_diagnostic = (
            "ERROR: AddressSanitizer: heap-buffer-overflow"
            if "address" in name
            else "runtime error: left shift of 1 by 31 places"
        )
        for trial in range(1, 4):
            run = runs / str(trial)
            command = json.loads((run / "command.json").read_text())
            raw = (run / "raw.log").read_text()
            observed = (
                command["exit"] == 0
                and expected_diagnostic in raw
                and "OWNER_TEST_RESULT control=0" in raw
                and (run / "events.log").read_text() == "EVENT 1\n"
                and not (run / "snapshot.diff").read_text()
            )
            actual_diagnostics.append(
                {"case": name, "trial": trial, "observed": observed}
            )
            qualified = qualified and observed
    (output / "result.json").write_text(
        json.dumps(
            {
                "tests": result.testsRun,
                "specified_failures": [
                    test._testMethodName for test, _ in result.failures
                ],
                "errors": len(result.errors),
                "skips": len(result.skipped),
                "positive_cases": result.testsRun
                - len(result.failures)
                - len(result.errors),
                "qualified_original_control": qualified,
                "verifier": str(verifier),
                "actual_diagnostics": actual_diagnostics,
            },
            indent=2,
        )
        + "\n"
    )
    if not qualified:
        raise AssertionError(
            "Original control did not fail only its two sanitizer assertions"
        )
    # Preserve the actual failing test-suite status; qualification is separate.
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
