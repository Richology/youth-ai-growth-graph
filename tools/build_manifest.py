#!/usr/bin/env python3
"""Build or verify the release manifest, counts, byte sizes, and SHA-256 hashes."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TARGET = DATA / "manifest.json"
DATA_FILES = sorted(path.name for path in DATA.glob("*.json") if path.name != "manifest.json")


def load(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def counts() -> dict:
    domains = load("domains.json")["domains"]
    candidates = load("candidate-pool.json")["candidates"]
    competencies = load("competencies.json")["competencies"]
    relationships = load("dependencies.json")["relationships"]
    return {
        "domains": len(domains),
        "subdomains": sum(len(domain["subdomains"]) for domain in domains),
        "candidates": len(candidates),
        "selected_candidates": sum(item["status"] == "selected" for item in candidates),
        "competencies": len(competencies),
        "relationships": len(relationships),
        "life_account_links": len(load("life-account-links.json")["links"]),
        "competency_guidance": len(load("competency-guidance.json")["guidance"]),
        "framework_references": len(load("framework-standards.json")["references"]),
        "competency_alignments": len(load("competency-alignments.json")["alignments"]),
        "learning_paths": len(load("learning-paths.json")["paths"]),
        "subdomain_guides": len(load("subdomain-guidance.json")["guides"]),
        "graph_metric_nodes": len(load("graph-metrics.json")["node_metrics"]),
    }


def file_metadata() -> dict:
    result = {}
    for name in DATA_FILES:
        content = (DATA / name).read_bytes()
        result[name] = {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    current = json.loads(TARGET.read_text(encoding="utf-8"))
    expected_counts = counts()
    expected_files = file_metadata()
    if args.write:
        current["generated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        current["counts"] = expected_counts
        current["files"] = expected_files
        TARGET.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {TARGET.relative_to(ROOT)} with {len(expected_files)} file hashes.")
        return 0
    if current.get("counts") != expected_counts or current.get("files") != expected_files:
        print("manifest.json is out of sync; run with --write.")
        return 1
    print(f"Manifest is synchronized: {len(expected_files)} files verified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
