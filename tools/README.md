# 工具

本目录提供采用 Apache-2.0 许可的图谱数据工具：

- [`validator/validate.py`](validator/validate.py)：零第三方依赖的数据一致性校验器。

```bash
python3 tools/validator/validate.py
python3 -m unittest discover -s tools/validator -p 'test_*.py'
```
