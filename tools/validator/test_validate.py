import subprocess
import sys
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
