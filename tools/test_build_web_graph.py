import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_web_graph


class WebGraphBuildTests(unittest.TestCase):
    def test_graph_counts_and_styles(self):
        graph = build_web_graph.build_graph()
        self.assertEqual(len(graph["domains"]), 4)
        self.assertEqual(len(graph["nodes"]), 60)
        self.assertEqual(len(graph["edges"]), 75)
        self.assertEqual({node["domain_id"] for node in graph["nodes"]}, {"AI", "BIZ", "PRO", "SOC"})
        self.assertTrue(all(len(node["star_position"]) == 3 for node in graph["nodes"]))
        self.assertTrue(all(len(node["terrain_position"]) == 3 for node in graph["nodes"]))

    def test_output_is_deterministic(self):
        graph = build_web_graph.build_graph()
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.json"
            second = Path(directory) / "second.json"
            build_web_graph.write_graph(graph, first)
            build_web_graph.write_graph(build_web_graph.build_graph(), second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual(json.loads(first.read_text())["meta"]["layout_version"], "1.0.0")


if __name__ == "__main__":
    unittest.main()
