# 图谱数据

本目录包含机器可读的能力图谱数据：

- `domains.json`：一级与二级领域；
- `candidate-pool.json`：72 项候选池、60 项选择结果与延期理由；
- `competencies.json`：能力节点；
- `dependencies.json`：节点关系；
- `life-account-links.json`：与财富、健康、关系的谨慎映射；
- `manifest.json`：数据版本与统计信息。

候选池共 72 项，其中 60 项为 `selected`，每个二级领域各 5 个；其余 12 项为 `deferred`。节点和数据集状态以文件字段及 `manifest.json` 为准。请勿将其作为标准化学生评价工具。

`life-account-links.json` 由 `competencies.json` 中的 `life_account_links` 自动派生，不应直接编辑。修改能力节点后运行：

```bash
python3 tools/sync_life_account_links.py --write
```
