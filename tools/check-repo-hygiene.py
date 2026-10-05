#!/usr/bin/env python3
"""Fail if the source publication contains release/runtime garbage.

In a Git clone the checker inspects tracked files (`git ls-files`).
Inside a FULL release bundle it inspects `source-sync-manifest.json` targets,
which represent the files that the publisher is allowed to place in GitHub.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]

FORBIDDEN_ROOTS = {
    "backend",
    "extension",
    "github-source",
    "test-results",
    "artifacts",
    "dist",
    "node_modules",
}
FORBIDDEN_SEGMENTS = {"bin", "obj", "node_modules", "test-results", "artifacts", "dist"}
FORBIDDEN_SUFFIXES = {".dll", ".exe", ".pdb", ".zip", ".db", ".db-wal", ".db-shm", ".log", ".vja", ".jsonl", ".pyc"}
FORBIDDEN_NAMES = {"candidate.private.json", "appsettings.local.json", "user-settings.cmd"}
RELEASE_DIR = re.compile(r"^Violetta-Apply-Assistant-", re.I)


def normalize(path: str) -> PurePosixPath:
    value = path.replace("\\", "/")
    while value.startswith("./"):
        value = value[2:]
    return PurePosixPath(value)


def tracked_paths() -> list[str]:
    if (ROOT / ".git").exists():
        result = subprocess.run(
            ["git", "-C", str(ROOT), "ls-files", "-z"],
            capture_output=True,
            check=True,
        )
        return [p.decode("utf-8", "surrogateescape") for p in result.stdout.split(b"\0") if p]

    manifest = ROOT / "source-sync-manifest.json"
    if manifest.exists():
        data = json.loads(manifest.read_text(encoding="utf-8"))
        return [str(row["target"]) for row in data.get("files", [])]

    raise RuntimeError("Run this checker from a Git clone or a FULL bundle containing source-sync-manifest.json")


def reason(path: str) -> str | None:
    p = normalize(path)
    if p.is_absolute() or ".." in p.parts:
        return "unsafe path"
    if not p.parts:
        return None
    if RELEASE_DIR.match(p.parts[0]):
        return "nested release/FULL directory"
    if p.parts[0].lower() in FORBIDDEN_ROOTS:
        return f"forbidden generated root: {p.parts[0]}"
    if any(part.lower() in FORBIDDEN_SEGMENTS for part in p.parts):
        return "generated/build directory"
    name = p.name.lower()
    if name in FORBIDDEN_NAMES:
        return "local/private configuration"
    if name == ".env" or (name.startswith(".env.") and name != ".env.example"):
        return "environment secret/config"
    lower = str(p).lower()
    if any(lower.endswith(suffix) for suffix in FORBIDDEN_SUFFIXES):
        return "runtime/build artifact"
    return None


def main() -> int:
    bad = [(path, reason(path)) for path in tracked_paths()]
    bad = [(path, why) for path, why in bad if why]
    if bad:
        print("Repository hygiene check FAILED:", file=sys.stderr)
        for path, why in bad:
            print(f"  - {path}: {why}", file=sys.stderr)
        return 1
    print("Repository hygiene check passed: no forbidden tracked release/runtime paths.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
