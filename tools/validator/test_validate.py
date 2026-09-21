import subprocess
import sys
import unittest
from copy import deepcopy
from unittest.mock import patch
from pathlib import Path

import validate as graph_validator

ROOT = Path(__file__).resolve().parents[2]
DATA_NAMES = (
    "domains.json",
    "competencies.json",
    "dependencies.json",
    "manifest.json",
    "candidate-pool.json",
    "life-account-links.json",
    "competency-guidance.json",
    "framework-standards.json",
    "competency-alignments.json",
    "learning-paths.json",
    "subdomain-guidance.json",
    "graph-metrics.json",
)


class GraphValidationTests(unittest.TestCase):
    def test_repository_data_is_valid(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools/validator/validate.py")],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("60 competencies", result.stdout)

    def test_all_json_files_parse(self):
        import json
        for path in [*ROOT.glob("data/*.json"), *ROOT.glob("schema/*.json")]:
            with self.subTest(path=path.name):
                json.loads(path.read_text(encoding="utf-8"))

    def test_life_account_links_are_reproducible(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools/sync_life_account_links.py")],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("synchronized", result.stdout)

    def test_competency_guidance_is_reproducible(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools/build_competency_guidance.py")],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("synchronized", result.stdout)

    def test_manifest_is_reproducible(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools/build_manifest.py")],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("synchronized", result.stdout)

    def test_graph_metrics_are_reproducible(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools/build_graph_metrics.py")],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("synchronized", result.stdout)

    def test_node_rejects_generic_draft_language(self):
        documents = {
            name: deepcopy(graph_validator.load_json(name))
            for name in DATA_NAMES
        }
        node = documents["competencies.json"]["competencies"][0]
        node["boundaries"].append("不等同于记忆术语、照搬模板或只完成一次任务。")

        with patch.object(
            graph_validator,
            "load_json",
            side_effect=lambda name: documents[name],
        ):
            with self.assertRaisesRegex(
                graph_validator.ValidationError, "Generic draft language remains"
            ):
                graph_validator.validate()

    def test_node_requires_external_calibration_source(self):
        documents = {
            name: deepcopy(graph_validator.load_json(name))
            for name in DATA_NAMES
        }
        node = documents["competencies.json"]["competencies"][0]
        node["sources"] = [
            source for source in node["sources"] if source["type"] == "practice"
        ]

        with patch.object(
            graph_validator,
            "load_json",
            side_effect=lambda name: documents[name],
        ):
            with self.assertRaisesRegex(
                graph_validator.ValidationError,
                "External calibration source is missing",
            ):
                graph_validator.validate()

    def test_relationship_rejects_generic_rationale(self):
        documents = {
            name: deepcopy(graph_validator.load_json(name))
            for name in DATA_NAMES
        }
        relationship = documents["dependencies.json"]["relationships"][0]
        relationship["rationale"] = (
            "某能力为该二级领域的综合基础能力提供一种可单独教学的实践。"
        )

        with patch.object(
            graph_validator,
            "load_json",
            side_effect=lambda name: documents[name],
        ):
            with self.assertRaisesRegex(
                graph_validator.ValidationError,
                "Generic relationship rationale remains",
            ):
                graph_validator.validate()

    def test_schema_closed_object_rejects_unknown_field(self):
        documents = {
            name: deepcopy(graph_validator.load_json(name))
            for name in DATA_NAMES
        }
        documents["competencies.json"]["competencies"][0]["internal_note"] = "x"

        with patch.object(
            graph_validator,
            "load_json",
            side_effect=lambda name: documents[name],
        ):
            with self.assertRaisesRegex(
                graph_validator.ValidationError,
                "unexpected fields: internal_note",
            ):
                graph_validator.validate()

    def test_relationship_rejects_generic_contexts(self):
        documents = {
            name: deepcopy(graph_validator.load_json(name))
            for name in DATA_NAMES
        }
        documents["dependencies.json"]["relationships"][0]["contexts"] = [
            "项目式学习",
            "真实或近真实任务",
        ]

        with patch.object(
            graph_validator,
            "load_json",
            side_effect=lambda name: documents[name],
        ):
            with self.assertRaisesRegex(
                graph_validator.ValidationError,
                "Generic relationship contexts remain",
            ):
                graph_validator.validate()


if __name__ == "__main__":
    unittest.main()
