#!/usr/bin/env python3
"""Full handler with actual owner schema, nanopb and Zephyr macro utilities."""

import argparse
from contextlib import nullcontext
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--source", type=Path, default=root / "src/studio/physical_layouts_handler.c"
)
parser.add_argument(
    "--output",
    type=Path,
    help="retain inputs, binaries, commands and logs in a fresh absolute directory",
)
parser.add_argument(
    "--variant",
    choices=(
        "all",
        "sanitized-root",
        "sanitized-nested",
        "optimized-root",
        "optimized-nested",
        "oversized",
    ),
    default="all",
    help="focus on one variant; only all can complete the canonical matrix",
)
args = parser.parse_args()
if args.output is not None:
    if (
        not args.output.is_absolute()
        or args.output.exists()
        or args.output.is_symlink()
    ):
        parser.error("output must be a fresh absolute directory")
    selected_output = args.output.resolve()
    source_roots = [root.resolve()]
    source = args.source.resolve()
    if source.parent.name == "studio" and source.parent.parent.name == "src":
        source_roots.append(source.parents[2])
    if any(selected_output.is_relative_to(source_root) for source_root in source_roots):
        parser.error("output must be outside owner source trees")
    selected_output.mkdir(parents=True, exist_ok=False)
    storage = nullcontext(selected_output)
else:
    storage = tempfile.TemporaryDirectory(prefix="physical-layout-protocol-")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


with storage as folder:
    work = Path(folder)
    results = {
        "schema": 1,
        "scope": "canonical" if args.variant == "all" else "focused",
        "variant": args.variant,
        "test_mode": os.environ.get("ZMK_TEST_MODE", "quick"),
        "handler_source": str(args.source.resolve()),
        "retained": args.output is not None,
        "status": "RUNNING",
        "full_matrix_completed": False,
        "operations": [],
        "binaries": {},
        "inputs": {},
        "completed_variants": [],
    }

    def save_results():
        temporary = work / "results.json.tmp"
        temporary.write_text(json.dumps(results, indent=2) + "\n")
        temporary.replace(work / "results.json")

    def retain_input(label, path):
        path = path.resolve()
        record = {"path": str(path), "sha256": digest(path)}
        if args.output is not None:
            destination = work / "inputs" / label
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, destination)
            record["copy"] = str(destination.relative_to(work))
        results["inputs"][label] = record

    def invoke(name, command, *, capture=False, binary=None, **kwargs):
        environment = dict(os.environ)
        recorded_environment = (
            "PATH",
            "LANG",
            "LC_ALL",
            "TZ",
            "TMPDIR",
            "PYTHONPATH",
            "NANOPB_SOURCE",
            "ZEPHYR_BASE",
            "ZMK_TEST_MODE",
            "ASAN_OPTIONS",
            "UBSAN_OPTIONS",
            "LSAN_OPTIONS",
            "ASAN_SYMBOLIZER_PATH",
            "LD_LIBRARY_PATH",
            "LD_PRELOAD",
            "LIBRARY_PATH",
            "CPATH",
            "C_INCLUDE_PATH",
            "GCC_EXEC_PREFIX",
            "COMPILER_PATH",
            "CC",
            "CFLAGS",
            "CPPFLAGS",
            "LDFLAGS",
            "CCACHE_DIR",
            "CCACHE_BASEDIR",
            "CCACHE_COMPILERCHECK",
            "CCACHE_NAMESPACE",
            "CCACHE_DISABLE",
            "SOURCE_DATE_EPOCH",
        )
        operation = {
            "name": name,
            "command": command,
            "cwd": str(Path.cwd().resolve()),
            "start_unix_ns": time.time_ns(),
            "environment": {
                key: environment[key]
                for key in recorded_environment
                if key in environment
            },
            "environment_sha256": hashlib.sha256(
                json.dumps(environment, sort_keys=True).encode()
            ).hexdigest(),
            "other_environment_values_omitted": True,
        }
        results["operations"].append(operation)
        save_results()
        start = time.monotonic_ns()
        try:
            if capture and args.output is not None:
                operation.update(stdout=f"{name}.stdout", stderr=f"{name}.stderr")
                with (
                    (work / operation["stdout"]).open("x") as stdout,
                    (work / operation["stderr"]).open("x") as stderr,
                ):
                    result = subprocess.run(
                        command, stdout=stdout, stderr=stderr, **kwargs
                    )
                result = subprocess.CompletedProcess(
                    command,
                    result.returncode,
                    (work / operation["stdout"]).read_text(errors="replace"),
                    (work / operation["stderr"]).read_text(errors="replace"),
                )
            elif capture:
                result = subprocess.run(
                    command, capture_output=True, text=True, **kwargs
                )
            elif args.output is not None:
                operation["log"] = f"{name}.log"
                with (work / operation["log"]).open("x") as log:
                    result = subprocess.run(
                        command, stdout=log, stderr=subprocess.STDOUT, **kwargs
                    )
            else:
                result = subprocess.run(command, **kwargs)
            operation["exit"] = result.returncode
            return result
        except subprocess.CalledProcessError as error:
            operation["exit"] = error.returncode
            raise
        except OSError as error:
            operation["error"] = {"type": type(error).__name__, "message": str(error)}
            raise
        finally:
            operation["elapsed_ns"] = time.monotonic_ns() - start
            if binary is not None and binary.is_file():
                results["binaries"][binary.name] = {
                    "path": str(binary),
                    "sha256": digest(binary),
                    "compiled": operation.get("exit") == 0,
                }
                (work / f"{binary.name}.sha256").write_text(
                    f"{digest(binary)}  {binary.name}\n"
                )
            if operation.get("log") and (work / operation["log"]).is_file():
                sys.stdout.write((work / operation["log"]).read_text(errors="replace"))
                sys.stdout.flush()
            save_results()

    def run():
        test_mode = results["test_mode"]
        if test_mode not in ("quick", "full"):
            raise SystemExit("ZMK_TEST_MODE must be quick or full")
        if args.variant != "all":
            print(
                f"FOCUSED protocol variant={args.variant}; canonical full matrix NOT RUN",
                flush=True,
            )
        retain_input("runner.py", Path(__file__))
        retain_input("handler.c", args.source)
        for name in ("harness.c", "framework.h", "fixture_dt.h"):
            retain_input("fixture/" + name, root / "tests/protocol" / name)
        for path in sorted((root / "proto").rglob("*")):
            if path.is_file():
                retain_input("owner/" + str(path.relative_to(root)), path)
        nanopb = Path(
            os.environ.get("NANOPB_SOURCE")
            or invoke(
                "nanopb-discovery",
                ["west", "list", "nanopb", "-f", "{abspath}"],
                capture=True,
                check=True,
            ).stdout.strip()
        )
        zephyr = Path(
            os.environ.get("ZEPHYR_BASE")
            or invoke(
                "zephyr-discovery",
                ["west", "list", "zephyr", "-f", "{abspath}"],
                capture=True,
                check=True,
            ).stdout.strip()
        )
        results.update(
            nanopb_source=str(nanopb.resolve()), zephyr_source=str(zephyr.resolve())
        )
        for path in sorted((*nanopb.glob("*.h"), *nanopb.glob("pb_*.c"))):
            retain_input("nanopb/" + path.name, path)
        for path in sorted((nanopb / "generator").rglob("*")):
            if path.is_file():
                retain_input("nanopb/" + str(path.relative_to(nanopb)), path)
        for path in sorted((zephyr / "include/zephyr/sys").glob("util*.h")):
            retain_input("zephyr/" + str(path.relative_to(zephyr)), path)
        compiler = shutil.which("cc")
        results["compiler"] = (
            {"path": str(Path(compiler).resolve()), "sha256": digest(Path(compiler))}
            if compiler
            else None
        )
        run_matrix(nanopb, zephyr, test_mode)

    def run_matrix(nanopb, zephyr, test_mode):
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
        invoke(
            "generate",
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
                if args.variant == "all":
                    continue
            binary = work / mode
            for layout, layout_flags in [
                ("root", []),
                ("nested", ["-DFIXTURE_NESTED_LAYOUT"]),
            ]:
                label = mode + "-" + layout
                if args.variant not in ("all", label):
                    continue
                binary = work / (mode + "-" + layout)
                invoke(
                    "compile-" + label,
                    compile_command(binary, flags + layout_flags),
                    check=True,
                    binary=binary,
                )
                print("COMPILED", mode, layout, flush=True)
                for repeat in range(1, 4):
                    invoke(f"run-{label}-{repeat}", [str(binary)], check=True)
                    print(mode, layout, "PASS repeat", repeat, flush=True)
                results["completed_variants"].append(label)
                save_results()

        # A devicetree string longer than its message field must not build: it
        # would otherwise be cut silently.
        if args.variant in ("all", "oversized"):
            oversized = invoke(
                "compile-oversized",
                compile_command(
                    work / "oversized", ["-O0", "-DFIXTURE_LONG_DISPLAY_NAME"]
                ),
                capture=True,
                binary=work / "oversized",
            )
            if (
                oversized.returncode == 0
                or "does not fit its RPC field" not in oversized.stderr
            ):
                raise SystemExit("a 70-byte display-name built against a 64-byte field")
            print("oversized devicetree string: rejected at build time", flush=True)
            results["completed_variants"].append("oversized")
        if args.variant != "all":
            print(
                f"physical-layout protocol focused: PASS variant={args.variant}; "
                "canonical full matrix NOT RUN",
                flush=True,
            )

    save_results()
    try:
        run()
    except BaseException as error:
        results.update(
            status="FAIL", failure={"type": type(error).__name__, "message": str(error)}
        )
        raise
    else:
        results["status"] = "PASS"
        results["full_matrix_completed"] = (
            args.variant == "all" and results["test_mode"] == "full"
        )
    finally:
        results["generated"] = {
            str(path.relative_to(work)): digest(path)
            for directory in (work / "generated", work / "include", work / "generator")
            for path in sorted(directory.rglob("*"))
            if path.is_file()
        }
        results["input_drift"] = [
            label
            for label, item in results["inputs"].items()
            if not Path(item["path"]).is_file()
            or digest(Path(item["path"])) != item["sha256"]
        ]
        if results["input_drift"]:
            results.update(status="FAIL", full_matrix_completed=False)
            results.setdefault(
                "failure",
                {
                    "type": "SourceDrift",
                    "message": "protocol source inputs changed during execution",
                },
            )
        save_results()
        if args.output is not None:
            print(f"Physical-layout protocol evidence retained: {work}", flush=True)
        if results["input_drift"] and results["failure"]["type"] == "SourceDrift":
            raise SystemExit("protocol source inputs changed during execution")
