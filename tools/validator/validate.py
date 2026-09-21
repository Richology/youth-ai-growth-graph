#!/usr/bin/env python3
"""Validate core Youth AI Growth Graph data without third-party packages."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
COMPETENCY_ID = re.compile(r"^(AI|BIZ|PRO|SOC)-[A-Z]{3}-[0-9]{3}$")
RELATIONSHIP_ID = re.compile(r"^REL-[0-9]{4}$")
SEMVER = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")


class ValidationError(Exception):
    """Raised when graph data violates a v0.1 invariant."""


def load_json(name: str) -> dict[str, Any]:
    path = DATA / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValidationError(f"Missing file: {path.relative_to(ROOT)}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(
            f"Invalid JSON in {path.relative_to(ROOT)} at line {exc.lineno}: {exc.msg}"
        ) from exc


def require_keys(item: dict[str, Any], keys: set[str], label: str) -> None:
    missing = sorted(keys - item.keys())
    if missing:
        raise ValidationError(f"{label} is missing fields: {', '.join(missing)}")


def validate() -> tuple[int, int, int, int]:
    domain_doc = load_json("domains.json")
    competency_doc = load_json("competencies.json")
    relationship_doc = load_json("dependencies.json")
    manifest = load_json("manifest.json")
    candidate_doc = load_json("candidate-pool.json")
    life_link_doc = load_json("life-account-links.json")

    domain_items = domain_doc.get("domains", [])
    competencies = competency_doc.get("competencies", [])
    relationships = relationship_doc.get("relationships", [])
    candidates = candidate_doc.get("candidates", [])
    life_links = life_link_doc.get("links", [])

    domains = {item["id"] for item in domain_items}
    subdomains = {
        subdomain["id"]
        for domain in domain_items
        for subdomain in domain.get("subdomains", [])
    }

    if len(domains) != 4:
        raise ValidationError(f"Expected 4 domains, found {len(domains)}")
    if len(subdomains) != 12:
        raise ValidationError(f"Expected 12 subdomains, found {len(subdomains)}")

    competency_fields = {
        "id",
        "version",
        "status",
        "name",
        "domain_id",
        "subdomain_id",
        "definition",
        "boundaries",
        "observable_behaviors",
        "proficiency_descriptors",
        "evidence_guidance",
        "life_account_links",
        "claim_status",
        "sources",
        "change_log",
    }
    competency_ids: set[str] = set()

    for item in competencies:
        node_id = item.get("id", "<unknown>")
        require_keys(item, competency_fields, f"Competency {node_id}")
        if not COMPETENCY_ID.fullmatch(node_id):
            raise ValidationError(f"Invalid competency ID: {node_id}")
        if node_id in competency_ids:
            raise ValidationError(f"Duplicate competency ID: {node_id}")
        competency_ids.add(node_id)
        if not SEMVER.fullmatch(item["version"]):
            raise ValidationError(f"Invalid version on {node_id}: {item['version']}")
        if item["domain_id"] not in domains:
            raise ValidationError(f"Unknown domain on {node_id}: {item['domain_id']}")
        if item["subdomain_id"] not in subdomains:
            raise ValidationError(
                f"Unknown subdomain on {node_id}: {item['subdomain_id']}"
            )
        if item["subdomain_id"].split(".", 1)[0] != item["domain_id"]:
            raise ValidationError(f"Domain/subdomain mismatch on {node_id}")
        if len(item["observable_behaviors"]) < 2:
            raise ValidationError(f"{node_id} needs at least two observable behaviors")
        if set(item["proficiency_descriptors"]) != {"E1", "E2", "E3", "E4"}:
            raise ValidationError(f"{node_id} must define E1, E2, E3 and E4")
        if item["status"] not in {"proposed", "draft", "stable", "deprecated"}:
            raise ValidationError(f"Invalid status on {node_id}")
        if item["claim_status"] not in {"principle", "observation", "hypothesis", "evidence"}:
            raise ValidationError(f"Invalid claim status on {node_id}")
        if not item["boundaries"] or not all(item["evidence_guidance"].get(k) for k in ("strong", "weak", "cautions")):
            raise ValidationError(f"Incomplete boundaries or evidence guidance on {node_id}")

    relationship_ids: set[str] = set()
    relationship_keys: set[tuple[str, str, str]] = set()
    for item in relationships:
        rel_id = item.get("id", "<unknown>")
        if not RELATIONSHIP_ID.fullmatch(rel_id):
            raise ValidationError(f"Invalid relationship ID: {rel_id}")
        if rel_id in relationship_ids:
            raise ValidationError(f"Duplicate relationship ID: {rel_id}")
        relationship_ids.add(rel_id)
        source = item.get("source_id")
        target = item.get("target_id")
        if source not in competency_ids or target not in competency_ids:
            raise ValidationError(f"Unknown node reference in {rel_id}")
        if source == target:
            raise ValidationError(f"Self relationship is not allowed: {rel_id}")
        if item.get("type") not in {"requires", "supports", "related_to"}:
            raise ValidationError(f"Unknown relationship type in {rel_id}")
        if item["type"] == "related_to" and source > target:
            raise ValidationError(
                f"related_to IDs must use alphabetical order in {rel_id}"
            )
        key = (source, target, item["type"])
        if key in relationship_keys:
            raise ValidationError(f"Duplicate relationship semantics in {rel_id}")
        relationship_keys.add(key)

    # requires edges encode source -> prerequisite. Any cycle is invalid.
    requires = {node_id: [] for node_id in competency_ids}
    for item in relationships:
        if item["type"] == "requires":
            requires[item["source_id"]].append(item["target_id"])
    visiting: set[str] = set()
    visited: set[str] = set()
    def visit(node_id: str) -> None:
        if node_id in visiting:
            raise ValidationError(f"requires cycle detected at {node_id}")
        if node_id in visited:
            return
        visiting.add(node_id)
        for target in requires[node_id]:
            visit(target)
        visiting.remove(node_id)
        visited.add(node_id)
    for node_id in competency_ids:
        visit(node_id)

    connected = {item[side] for item in relationships for side in ("source_id", "target_id")}
    isolated = sorted(competency_ids - connected)
    if isolated:
        raise ValidationError(f"Isolated competency nodes: {', '.join(isolated)}")

    candidate_ids: set[str] = set()
    selected: set[str] = set()
    for item in candidates:
        candidate_id = item.get("candidate_id", "<unknown>")
        if candidate_id in candidate_ids:
            raise ValidationError(f"Duplicate candidate ID: {candidate_id}")
        candidate_ids.add(candidate_id)
        if item.get("subdomain_id") not in subdomains:
            raise ValidationError(f"Unknown candidate subdomain: {candidate_id}")
        if item.get("status") == "selected":
            node_id = item.get("competency_id")
            if node_id not in competency_ids:
                raise ValidationError(f"Selected candidate lacks competency: {candidate_id}")
            selected.add(node_id)
        elif item.get("status") in {"deferred", "rejected"} and not item.get("reason"):
            raise ValidationError(f"Unselected candidate lacks reason: {candidate_id}")
    if len(candidates) != 72 or len(selected) != 60 or selected != competency_ids:
        raise ValidationError("Candidate pool must contain 72 items selecting exactly all 60 competencies")

    expected_links = {(node["id"], link["account"], link["relation"], link["rationale"]) for node in competencies for link in node["life_account_links"]}
    actual_links = {(link["competency_id"], link["account"], link["relation"], link["rationale"]) for link in life_links}
    if actual_links != expected_links:
        raise ValidationError("life-account-links.json is not synchronized with competencies.json")

    actual_counts = {
        "domains": len(domains),
        "subdomains": len(subdomains),
        "candidates": len(candidates),
        "selected_candidates": len(selected),
        "competencies": len(competencies),
        "relationships": len(relationships),
    }
    if manifest.get("counts") != actual_counts:
        raise ValidationError(
            f"Manifest counts {manifest.get('counts')} do not match {actual_counts}"
        )

    return (
        actual_counts["domains"],
        actual_counts["subdomains"],
        actual_counts["competencies"],
        actual_counts["relationships"],
    )


def main() -> int:
    try:
        domains, subdomains, competencies, relationships = validate()
    except ValidationError as exc:
        print(f"Validation failed: {exc}", file=sys.stderr)
        return 1

    print(
        "Validation passed: "
        f"{domains} domains, {subdomains} subdomains, "
        f"{competencies} competencies, {relationships} relationships."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
