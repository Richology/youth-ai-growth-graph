#!/usr/bin/env python3
"""Build the deterministic, browser-facing graph artifact."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = ROOT / "site" / "public" / "data" / "graph.json"
LAYOUT_VERSION = "1.0.0"

DOMAIN_STYLE = {
    "AI": {"color": "#0CA8D4", "marker": "circle"},
    "BIZ": {"color": "#C5EE4C", "marker": "ring"},
    "PRO": {"color": "#FF7664", "marker": "diamond"},
    "SOC": {"color": "#F5C325", "marker": "hexagon"},
}

DOMAIN_CENTERS = {
    "AI": (-5.4, -3.3),
    "BIZ": (5.2, -3.1),
    "PRO": (-4.8, 3.5),
    "SOC": (5.0, 3.4),
}


def load_json(name: str) -> dict[str, Any]:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def stable_values(value: str, count: int = 4) -> list[float]:
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    return [int.from_bytes(digest[i * 2 : i * 2 + 2], "big") / 65535 for i in range(count)]


def strongly_connected_components(
    node_ids: list[str], requires: list[dict[str, Any]]
) -> tuple[dict[str, int], list[list[str]]]:
    adjacency: dict[str, list[str]] = {node_id: [] for node_id in node_ids}
    for edge in requires:
        adjacency[edge["source_id"]].append(edge["target_id"])

    index = 0
    indices: dict[str, int] = {}
    lowlinks: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    components: list[list[str]] = []

    def visit(node_id: str) -> None:
        nonlocal index
        indices[node_id] = index
        lowlinks[node_id] = index
        index += 1
        stack.append(node_id)
        on_stack.add(node_id)

        for target_id in adjacency[node_id]:
            if target_id not in indices:
                visit(target_id)
                lowlinks[node_id] = min(lowlinks[node_id], lowlinks[target_id])
            elif target_id in on_stack:
                lowlinks[node_id] = min(lowlinks[node_id], indices[target_id])

        if lowlinks[node_id] == indices[node_id]:
            component: list[str] = []
            while stack:
                member = stack.pop()
                on_stack.remove(member)
                component.append(member)
                if member == node_id:
                    break
            components.append(sorted(component))

    for node_id in sorted(node_ids):
        if node_id not in indices:
            visit(node_id)

    membership = {
        node_id: component_index
        for component_index, component in enumerate(components)
        for node_id in component
    }
    return membership, components


def prerequisite_depths(
    node_ids: list[str], relationships: list[dict[str, Any]]
) -> dict[str, int]:
    requires = [edge for edge in relationships if edge["type"] == "requires"]
    membership, components = strongly_connected_components(node_ids, requires)
    prerequisites: dict[int, set[int]] = {index: set() for index in range(len(components))}
    for edge in requires:
        source_component = membership[edge["source_id"]]
        target_component = membership[edge["target_id"]]
        if source_component != target_component:
            prerequisites[source_component].add(target_component)

    memo: dict[int, int] = {}

    def component_depth(component: int) -> int:
        if component in memo:
            return memo[component]
        targets = prerequisites[component]
        memo[component] = 0 if not targets else 1 + max(component_depth(item) for item in targets)
        return memo[component]

    return {node_id: component_depth(membership[node_id]) for node_id in node_ids}


def build_graph() -> dict[str, Any]:
    domains_doc = load_json("domains.json")
    competencies_doc = load_json("competencies.json")
    dependencies_doc = load_json("dependencies.json")
    metrics_doc = load_json("graph-metrics.json")
    manifest = load_json("manifest.json")

    competencies = competencies_doc["competencies"]
    relationships = dependencies_doc["relationships"]
    node_ids = [item["id"] for item in competencies]
    depth = prerequisite_depths(node_ids, relationships)
    metrics = {item["competency_id"]: item for item in metrics_doc["node_metrics"]}

    subdomain_lookup: dict[str, dict[str, Any]] = {}
    subdomain_index: dict[str, int] = {}
    domains: list[dict[str, Any]] = []
    for domain in domains_doc["domains"]:
        styled = {
            "id": domain["id"],
            "name": domain["name"]["zh"],
            "definition": domain["definition"],
            **DOMAIN_STYLE[domain["id"]],
            "subdomains": [],
        }
        for index, subdomain in enumerate(domain["subdomains"]):
            compact = {
                "id": subdomain["id"],
                "name": subdomain["name"]["zh"],
                "definition": subdomain["definition"],
            }
            styled["subdomains"].append(compact)
            subdomain_lookup[subdomain["id"]] = compact
            subdomain_index[subdomain["id"]] = index
        domains.append(styled)

    nodes: list[dict[str, Any]] = []
    domain_order = list(DOMAIN_STYLE)
    for item in sorted(competencies, key=lambda entry: entry["id"]):
        node_id = item["id"]
        domain_id = item["domain_id"]
        random_a, random_b, random_c, random_d = stable_values(node_id)
        domain_angle = domain_order.index(domain_id) * math.tau / len(domain_order) - math.pi / 4
        sub_index = subdomain_index[item["subdomain_id"]]
        sub_angle = (sub_index - 1) * 0.28
        radius = 5.4 + sub_index * 1.35 + (random_a - 0.5) * 1.4
        star_angle = domain_angle + sub_angle + (random_b - 0.5) * 0.18
        star_position = [
            round(math.cos(star_angle) * radius + (random_c - 0.5) * 1.2, 4),
            round((depth[node_id] - 1.0) * 2.15 + (random_d - 0.5) * 1.2, 4),
            round(math.sin(star_angle) * radius + (random_a - 0.5) * 1.2, 4),
        ]

        center_x, center_z = DOMAIN_CENTERS[domain_id]
        local_angle = sub_index * math.tau / 3 + (random_b - 0.5) * 0.55
        local_radius = 1.1 + random_c * 2.0
        terrain_position = [
            round(center_x + math.cos(local_angle) * local_radius + (random_a - 0.5), 4),
            round(0.45 + depth[node_id] * 0.72 + metrics[node_id]["total_incident"] * 0.07, 4),
            round(center_z + math.sin(local_angle) * local_radius + (random_d - 0.5), 4),
        ]

        nodes.append(
            {
                "id": node_id,
                "name": item["name"]["zh"],
                "domain_id": domain_id,
                "subdomain_id": item["subdomain_id"],
                "subdomain_name": subdomain_lookup[item["subdomain_id"]]["name"],
                "definition": item["definition"]["zh"],
                "boundaries": item["boundaries"],
                "observable_behaviors": item["observable_behaviors"],
                "proficiency": item["proficiency_descriptors"],
                "evidence": item["evidence_guidance"],
                "life_account_links": item["life_account_links"],
                "sources": item["sources"],
                "change_log": item["change_log"],
                "status": item["status"],
                "version": item["version"],
                "claim_status": item["claim_status"],
                "metrics": metrics[node_id],
                "star_position": star_position,
                "terrain_position": terrain_position,
            }
        )

    edges = [
        {
            "id": edge["id"],
            "source": edge["source_id"],
            "target": edge["target_id"],
            "type": edge["type"],
            "rationale": edge["rationale"],
        }
        for edge in relationships
    ]

    return {
        "meta": {
            "project": manifest["project"],
            "graph_version": manifest["graph_version"],
            "released_at": manifest["released_at"],
            "status": competencies_doc["status"],
            "layout_version": LAYOUT_VERSION,
            "counts": manifest["counts"],
            "notice": manifest["notice"],
        },
        "domains": domains,
        "nodes": nodes,
        "edges": edges,
    }


def write_graph(graph: dict[str, Any], output: Path = OUTPUT) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(graph, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    graph = build_graph()
    write_graph(graph)
    print(
        f"Built {OUTPUT.relative_to(ROOT)}: "
        f"{len(graph['nodes'])} nodes, {len(graph['edges'])} edges."
    )


if __name__ == "__main__":
    main()
