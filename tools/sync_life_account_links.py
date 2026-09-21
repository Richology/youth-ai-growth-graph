#!/usr/bin/env python3
"""Check or rebuild the derived life-account link dataset."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPETENCIES_PATH = ROOT / "data" / "competencies.json"
LINKS_PATH = ROOT / "data" / "life-account-links.json"


def build_document() -> dict:
    competencies = json.loads(COMPETENCIES_PATH.read_text(encoding="utf-8"))
    links = [
        {"competency_id": node["id"], **link}
        for node in competencies["competencies"]
        for link in node["life_account_links"]
    ]
    return {
        "schema_version": "0.1.0",
        "status": "draft",
        "source_of_truth": "Generated from competencies.json; do not edit directly.",
        "links": links,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check or rebuild data/life-account-links.json."
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Rewrite the derived file. Without this flag, only check synchronization.",
    )
    args = parser.parse_args()
    expected = build_document()

    if args.write:
        LINKS_PATH.write_text(
            json.dumps(expected, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Updated {LINKS_PATH.relative_to(ROOT)} with {len(expected['links'])} links.")
        return 0

    actual = json.loads(LINKS_PATH.read_text(encoding="utf-8"))
    if actual != expected:
        print("life-account-links.json is out of sync; run with --write.")
        return 1
    print(f"Life-account links are synchronized: {len(expected['links'])} links.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
