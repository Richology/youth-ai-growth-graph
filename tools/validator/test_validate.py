import subprocess
import sys
import unittest
from copy import deepcopy
from unittest.mock import patch
from pathlib import Path

import validate as graph_validator

ROOT = Path(__file__).resolve().parents[2]


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

    def test_node_rejects_generic_draft_language(self):
        documents = {
            name: deepcopy(graph_validator.load_json(name))
            for name in (
                "domains.json",
                "competencies.json",
                "dependencies.json",
                "manifest.json",
                "candidate-pool.json",
                "life-account-links.json",
            )
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
            for name in (
                "domains.json",
                "competencies.json",
                "dependencies.json",
                "manifest.json",
                "candidate-pool.json",
                "life-account-links.json",
            )
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


if __name__ == "__main__":
    unittest.main()
