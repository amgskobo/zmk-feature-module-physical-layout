#!/usr/bin/env python3
"""Full handler with actual owner schema, nanopb and Zephyr macro utilities."""

from pathlib import Path
import argparse
import os
import re
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--source", type=Path, default=root / "src/studio/physical_layouts_handler.c"
)
args = parser.parse_args()
nanopb = Path(
    os.environ.get("NANOPB_SOURCE")
    or subprocess.check_output(
        ["west", "list", "nanopb", "-f", "{abspath}"], text=True
    ).strip()
)
zephyr = Path(
    os.environ.get("ZEPHYR_BASE")
    or subprocess.check_output(
        ["west", "list", "zephyr", "-f", "{abspath}"], text=True
    ).strip()
)
test_mode = os.environ.get("ZMK_TEST_MODE", "quick")
if test_mode not in ("quick", "full"):
    raise SystemExit("ZMK_TEST_MODE must be quick or full")
with tempfile.TemporaryDirectory(prefix="physical-layout-protocol-") as folder:
    work = Path(folder)
    include = work / "include"
    generated = work / "generated"
    generated.mkdir()
    for name in re.findall(r"#include <([^>]+)>", args.source.read_text()):
        if name.startswith("pb_") or name.endswith(".pb.h"):
            continue
        path = include / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            '#include "framework.h"\n'
            + ('#include "fixture_dt.h"\n' if name == "zephyr/devicetree.h" else "")
        )
    shutil.copytree(nanopb / "generator", work / "generator")
    subprocess.run(
        [
            "python3",
            str(work / "generator/nanopb_generator.py"),
            "-I",
            str(root / "proto"),
            "-D",
            str(generated),
            str(root / "proto/zmk/physical_layouts/physical_layouts.proto"),
        ],
        check=True,
    )

    def compile_command(binary, flags):
        return [
            "cc",
            "-std=c11",
            "-Wall",
            "-Wextra",
            "-Werror",
            "-Wshadow",
            "-Wno-unused-parameter",
            *flags,
            '-DOWNER_HANDLER_SOURCE="' + str(args.source.resolve()) + '"',
            "-I" + str(include),
            "-I" + str(root / "tests/protocol"),
            "-I" + str(generated),
            "-I" + str(nanopb),
            "-I" + str(zephyr / "include"),
            str(root / "tests/protocol/harness.c"),
            *map(str, generated.rglob("*.pb.c")),
            *(
                str(nanopb / name)
                for name in ("pb_common.c", "pb_encode.c", "pb_decode.c")
            ),
            "-o",
            str(binary),
        ]

    for mode, flags in [
        (
            "sanitized",
            [
                "-O1",
                "-g",
                "-fsanitize=address,undefined",
                "-fno-sanitize-recover=all",
                "-fno-pie",
                "-no-pie",
            ],
        ),
        ("optimized", ["-O2"]),
    ]:
        if mode == "optimized" and test_mode != "full":
            continue
        binary = work / mode
        subprocess.run(compile_command(binary, flags), check=True)
        print("COMPILED", mode, flush=True)
        subprocess.run([str(binary)], check=True)
        print(mode, "PASS", flush=True)

    # A devicetree string longer than its message field must not build: it
    # would otherwise be cut silently.
    oversized = subprocess.run(
        compile_command(work / "oversized", ["-O0", "-DFIXTURE_LONG_DISPLAY_NAME"]),
        capture_output=True,
        text=True,
    )
    if (
        oversized.returncode == 0
        or "does not fit its RPC field" not in oversized.stderr
    ):
        raise SystemExit("a 70-byte display-name built against a 64-byte field")
    print("oversized devicetree string: rejected at build time", flush=True)
