# 数据校验器

该工具只使用 Python 标准库，用于检查 v0.1 图谱数据的基本一致性。

在仓库根目录运行：

```bash
python3 tools/validator/validate.py
python3 -m unittest discover -s tools/validator -p 'test_*.py'
```

校验覆盖领域与候选池计数、节点字段、引用完整性、重复关系、`requires` 环、孤立节点、人生课题派生数据和 manifest 一致性。GitHub Actions 会在 push 和 pull request 时运行同一套检查。

当前检查：

- JSON 文件是否可以解析；
- 领域与二级领域数量；
- 能力和关系 ID 格式及唯一性；
- 能力必填字段、领域归属和四级描述；
- 本地化文本、来源、人生课题映射、版本记录，以及已升级节点中的批量模板残留；
- 关系引用、类型、自关联与对称关系顺序；
- 关系理由、情境、来源、状态与版本；
- `manifest.json` 统计是否与数据一致。

校验通过只代表数据结构一致，不代表能力定义已经获得教育学验证。
