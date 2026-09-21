# 工具

本目录提供采用 Apache-2.0 许可的图谱数据工具：

- [`validator/validate.py`](validator/validate.py)：零第三方依赖的数据一致性校验器。
- [`sync_life_account_links.py`](sync_life_account_links.py)：检查或重建由能力节点派生的人生课题映射。
- [`build_competency_guidance.py`](build_competency_guidance.py)：检查或重建逐节点证据任务与发展支持数据。
- [`build_manifest.py`](build_manifest.py)：检查或重建统计、字节数和 SHA-256 文件清单。
- [`build_graph_metrics.py`](build_graph_metrics.py)：检查或重建网站可用的图与路径指标。

```bash
python3 tools/validator/validate.py
python3 -m unittest discover -s tools/validator -p 'test_*.py'
python3 tools/sync_life_account_links.py
python3 tools/sync_life_account_links.py --write
python3 tools/build_competency_guidance.py
python3 tools/build_competency_guidance.py --write
python3 tools/build_graph_metrics.py
python3 tools/build_graph_metrics.py --write
python3 tools/build_manifest.py
python3 tools/build_manifest.py --write
```
