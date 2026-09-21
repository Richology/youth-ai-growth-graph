# 工具

本目录提供采用 Apache-2.0 许可的图谱数据工具：

- [`validator/validate.py`](validator/validate.py)：零第三方依赖的数据一致性校验器。
- [`sync_life_account_links.py`](sync_life_account_links.py)：检查或重建由能力节点派生的人生课题映射。

```bash
python3 tools/validator/validate.py
python3 -m unittest discover -s tools/validator -p 'test_*.py'
python3 tools/sync_life_account_links.py
python3 tools/sync_life_account_links.py --write
```
