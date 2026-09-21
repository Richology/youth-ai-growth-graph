#!/usr/bin/env python3
"""Build or verify graph and learning-path metrics for applications."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TARGET = DATA / "graph-metrics.json"


def load(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def build_document() -> dict:
    nodes = load("competencies.json")["competencies"]
    relationships = load("dependencies.json")["relationships"]
    paths = load("learning-paths.json")["paths"]
    node_domain = {node["id"]: node["domain_id"] for node in nodes}
    incoming = Counter()
    outgoing = Counter()
    undirected = Counter()
    type_counts = Counter()
    cross_domain = 0
    for relationship in relationships:
        if relationship["type"] == "related_to":
            undirected[relationship["source_id"]] += 1
            undirected[relationship["target_id"]] += 1
        else:
            incoming[relationship["target_id"]] += 1
            outgoing[relationship["source_id"]] += 1
        type_counts[relationship["type"]] += 1
        cross_domain += node_domain[relationship["source_id"]] != node_domain[relationship["target_id"]]
    node_metrics = []
    for node_id in sorted(node_domain):
        node_metrics.append(
            {
                "competency_id": node_id,
                "incoming_directed": incoming[node_id],
                "outgoing_directed": outgoing[node_id],
                "undirected_related": undirected[node_id],
                "total_incident": incoming[node_id] + outgoing[node_id] + undirected[node_id],
            }
        )
    path_metrics = []
    for path in paths:
        domains = [node_domain[node_id] for node_id in path["steps"]]
        path_metrics.append(
            {
                "path_id": path["id"],
                "step_count": len(path["steps"]),
                "domains_covered": sorted(set(domains)),
                "cross_domain_transitions": sum(left != right for left, right in zip(domains, domains[1:])),
            }
        )
    isolated = [item["competency_id"] for item in node_metrics if item["total_incident"] == 0]
    return {
        "schema_version": "0.1.0",
        "status": "draft",
        "source_of_truth": ["competencies.json", "dependencies.json", "learning-paths.json"],
        "summary": {
            "node_count": len(nodes),
            "relationship_count": len(relationships),
            "relationship_types": dict(sorted(type_counts.items())),
            "cross_domain_relationships": cross_domain,
            "connected_node_count": len(nodes) - len(isolated),
            "isolated_node_ids": isolated,
            "average_incident_relationships": round((2 * len(relationships)) / len(nodes), 2),
        },
        "node_metrics": node_metrics,
        "path_metrics": path_metrics,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    expected = build_document()
    if args.write:
        TARGET.write_text(json.dumps(expected, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {TARGET.relative_to(ROOT)} with {len(expected['node_metrics'])} node metrics.")
        return 0
    if not TARGET.exists() or json.loads(TARGET.read_text(encoding="utf-8")) != expected:
        print("graph-metrics.json is out of sync; run with --write.")
        return 1
    print(f"Graph metrics are synchronized: {len(expected['node_metrics'])} nodes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
