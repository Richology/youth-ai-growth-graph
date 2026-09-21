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

    domain_items = domain_doc.get("domains", [])
    competencies = competency_doc.get("competencies", [])
    relationships = relationship_doc.get("relationships", [])

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

    relationship_ids: set[str] = set()
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

    actual_counts = {
        "domains": len(domains),
        "subdomains": len(subdomains),
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
