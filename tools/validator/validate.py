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
ISO_DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
GENERIC_DRAFT_PHRASES = {
    "不等同于记忆术语、照搬模板或只完成一次任务。",
    "评价时应结合情境、过程与学习者实际承担的判断。",
    "能解释关键选择，并在新的材料或情境中再次应用。",
}


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


def require_nonempty_strings(values: Any, label: str, minimum: int = 1) -> None:
    if not isinstance(values, list) or len(values) < minimum:
        raise ValidationError(f"{label} needs at least {minimum} item(s)")
    if not all(isinstance(value, str) and value.strip() for value in values):
        raise ValidationError(f"{label} must contain non-empty strings")


def is_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


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
        for field in ("name", "definition"):
            localized = item[field]
            if (
                not isinstance(localized, dict)
                or set(localized) != {"zh", "en"}
                or not all(is_nonempty_string(value) for value in localized.values())
            ):
                raise ValidationError(f"Invalid localized {field} on {node_id}")
        if item["domain_id"] not in domains:
            raise ValidationError(f"Unknown domain on {node_id}: {item['domain_id']}")
        if item["subdomain_id"] not in subdomains:
            raise ValidationError(
                f"Unknown subdomain on {node_id}: {item['subdomain_id']}"
            )
        if item["subdomain_id"].split(".", 1)[0] != item["domain_id"]:
            raise ValidationError(f"Domain/subdomain mismatch on {node_id}")
        require_nonempty_strings(item["boundaries"], f"Boundaries on {node_id}")
        require_nonempty_strings(item["observable_behaviors"], f"Observable behaviors on {node_id}", 2)
        if set(item["proficiency_descriptors"]) != {"E1", "E2", "E3", "E4"}:
            raise ValidationError(f"{node_id} must define E1, E2, E3 and E4")
        if item["status"] not in {"proposed", "draft", "stable", "deprecated"}:
            raise ValidationError(f"Invalid status on {node_id}")
        if item["claim_status"] not in {"principle", "observation", "hypothesis", "evidence"}:
            raise ValidationError(f"Invalid claim status on {node_id}")
        evidence = item["evidence_guidance"]
        if set(evidence) != {"strong", "weak", "cautions"}:
            raise ValidationError(f"Invalid evidence guidance fields on {node_id}")
        for kind in ("strong", "weak", "cautions"):
            require_nonempty_strings(evidence[kind], f"{kind} evidence on {node_id}")
        node_text = [*item["boundaries"], *evidence["strong"], *evidence["weak"], *evidence["cautions"]]
        generic = sorted(GENERIC_DRAFT_PHRASES.intersection(node_text))
        if generic and item["version"] != "0.1.0":
            raise ValidationError(f"Generic draft language remains on {node_id}: {generic[0]}")
        for link in item["life_account_links"]:
            require_keys(link, {"account", "relation", "rationale"}, f"Life-account link on {node_id}")
            if link["account"] not in {"wealth", "health", "relationships"} or link["relation"] != "may_contribute_to":
                raise ValidationError(f"Invalid life-account link on {node_id}")
        for source in item["sources"]:
            require_keys(source, {"type", "citation"}, f"Source on {node_id}")
            if source["type"] not in {"practice", "research", "framework", "community"} or not is_nonempty_string(source["citation"]):
                raise ValidationError(f"Invalid source on {node_id}")
        logged_versions = set()
        for change in item["change_log"]:
            require_keys(change, {"version", "date", "summary"}, f"Change log on {node_id}")
            if (
                not isinstance(change["version"], str)
                or not SEMVER.fullmatch(change["version"])
                or not isinstance(change["date"], str)
                or not ISO_DATE.fullmatch(change["date"])
            ):
                raise ValidationError(f"Invalid change-log version or date on {node_id}")
            logged_versions.add(change["version"])
        if item["version"] not in logged_versions:
            raise ValidationError(f"Current version is missing from change log on {node_id}")

    relationship_ids: set[str] = set()
    relationship_keys: set[tuple[str, str, str]] = set()
    for item in relationships:
        rel_id = item.get("id", "<unknown>")
        require_keys(
            item,
            {"id", "source_id", "target_id", "type", "rationale", "contexts", "status", "version", "sources"},
            f"Relationship {rel_id}",
        )
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
        if item["status"] not in {"proposed", "draft", "stable", "deprecated"} or not SEMVER.fullmatch(item["version"]):
            raise ValidationError(f"Invalid status or version in {rel_id}")
        if not isinstance(item["rationale"], str) or not item["rationale"].strip():
            raise ValidationError(f"Empty rationale in {rel_id}")
        require_nonempty_strings(item["contexts"], f"Contexts in {rel_id}")
        require_nonempty_strings(item["sources"], f"Sources in {rel_id}")
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
