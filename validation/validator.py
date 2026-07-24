"""APEX-AI deterministic validator.

    THE VERDICT IS A PURE FUNCTION OF PROCESS EXIT CODES.
    THERE IS NO LLM, NO MODEL CALL, AND NO HEURISTIC IN THIS FILE.

Given a list of criteria and a repository path, the validator runs each
criterion's shell command in that repo, captures the exit code plus a
truncated tail of stdout/stderr as evidence, and decides pass/fail by a
single rule:

    criterion passes  <=>  exit_code == expect_exit_code
    overall verdict   <=>  every criterion passes

Because the verdict depends only on exit codes, re-running the validator
against the same repository state always yields the same verdict. That
determinism is the product guarantee; open this file if a judge asks
whether the model can talk its way to green. It cannot.

A criterion is a dict:
    {
      "id": "edge-cases",
      "description": "Edge-case robustness",
      "type": "test" | "lint" | "command",
      "command": "python -m pytest acceptance/test_edge_cases.py -q",
      "expect_exit_code": 0,     # optional, default 0
      "timeout": 120             # optional, seconds, default 300
    }

A CriterionResult is a dict (shape matches the run-state contract):
    {
      "id", "description", "command", "type",
      "status": "pass" | "fail" | "error",
      "exit_code", "expected_exit_code",
      "duration_s", "evidence"
    }
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

EVIDENCE_MAX_CHARS = 2000
DEFAULT_TIMEOUT = 300


def _truncate_tail(text: str, limit: int = EVIDENCE_MAX_CHARS) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return "...[truncated]...\n" + text[-limit:]


def run_criterion(criterion: dict[str, Any], repo_path: str | Path) -> dict[str, Any]:
    """Run one criterion and return its structured result.

    The only thing that determines status is whether the observed exit
    code equals the expected exit code.
    """
    repo_path = Path(repo_path)
    command = criterion["command"]
    expected = int(criterion.get("expect_exit_code", 0))
    timeout = int(criterion.get("timeout", DEFAULT_TIMEOUT))

    result: dict[str, Any] = {
        "id": criterion["id"],
        "description": criterion.get("description", criterion["id"]),
        "command": command,
        "type": criterion.get("type", "command"),
        "expected_exit_code": expected,
        "exit_code": None,
        "status": "error",
        "duration_s": 0.0,
        "evidence": "",
    }

    start = time.monotonic()
    try:
        proc = subprocess.run(
            command,
            cwd=str(repo_path),
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        result["duration_s"] = round(time.monotonic() - start, 3)
        result["status"] = "error"
        partial = (exc.stdout or "") + (exc.stderr or "")
        if isinstance(partial, bytes):
            partial = partial.decode(errors="replace")
        result["evidence"] = _truncate_tail(
            f"TIMEOUT after {timeout}s\n{partial}"
        )
        return result
    except OSError as exc:
        result["duration_s"] = round(time.monotonic() - start, 3)
        result["status"] = "error"
        result["evidence"] = _truncate_tail(f"failed to launch command: {exc}")
        return result

    result["duration_s"] = round(time.monotonic() - start, 3)
    result["exit_code"] = proc.returncode
    result["status"] = "pass" if proc.returncode == expected else "fail"
    combined = (proc.stdout or "") + (
        ("\n--- stderr ---\n" + proc.stderr) if proc.stderr else ""
    )
    result["evidence"] = _truncate_tail(combined)
    return result


def check(criteria: list[dict[str, Any]], repo_path: str | Path) -> dict[str, Any]:
    """Run all criteria and compute the deterministic verdict."""
    results = [run_criterion(c, repo_path) for c in criteria]
    verdict = all(r["status"] == "pass" for r in results)
    return {
        "verdict": "pass" if verdict else "fail",
        "passed": verdict,
        "total": len(results),
        "passed_count": sum(1 for r in results if r["status"] == "pass"),
        "criteria": results,
    }


def load_criteria(path: str | Path) -> list[dict[str, Any]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    # Accept either a bare list or {"criteria": [...]}.
    if isinstance(data, dict):
        return data["criteria"]
    return data


def _print_human(report: dict[str, Any]) -> None:
    print(f"\nVERDICT: {report['verdict'].upper()} "
          f"({report['passed_count']}/{report['total']} criteria passed)\n")
    for r in report["criteria"]:
        mark = {"pass": "PASS", "fail": "FAIL", "error": "ERR "}[r["status"]]
        print(f"  [{mark}] {r['id']:<16} exit={r['exit_code']} "
              f"(expected {r['expected_exit_code']}, {r['duration_s']}s)")
        print(f"         {r['description']}")
        print(f"         $ {r['command']}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="APEX-AI deterministic validator")
    parser.add_argument("--repo", required=True, help="path to the target repository")
    parser.add_argument("--criteria", required=True, help="path to criteria JSON file")
    parser.add_argument("--json", action="store_true", help="emit the report as JSON")
    parser.add_argument("--out", help="write the JSON report to this file")
    args = parser.parse_args(argv)

    criteria = load_criteria(args.criteria)
    report = check(criteria, args.repo)

    if args.out:
        Path(args.out).write_text(json.dumps(report, indent=2), encoding="utf-8")

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        _print_human(report)

    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
