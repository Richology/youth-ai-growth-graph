# 图谱数据

本目录包含机器可读的能力图谱数据：

- `domains.json`：一级与二级领域；
- `candidate-pool.json`：72 项候选池、60 项选择结果与延期理由；
- `competencies.json`：能力节点；
- `dependencies.json`：节点关系；
- `life-account-links.json`：与财富、健康、关系的谨慎映射；
- `competency-guidance.json`：逐节点的观察任务、发展支持与成人责任边界；
- `subdomain-guidance.json`：面向青少年、教师和家庭的二级领域说明；
- `framework-standards.json`：外部框架的精确引用、版本与使用边界；
- `competency-alignments.json`：每个二级领域的首批外部框架映射；
- `learning-paths.json`：可用于课程与网站导航的跨领域学习路径；
- `graph-metrics.json`：可重复生成的连接度、跨领域关系和路径覆盖指标；
- `manifest.json`：数据版本、统计、文件字节数与 SHA-256 哈希。

候选池共 72 项，其中 60 项为 `selected`，每个二级领域各 5 个；其余 12 项为 `deferred`。节点和数据集状态以文件字段及 `manifest.json` 为准。请勿将其作为标准化学生评价工具。

`life-account-links.json` 由 `competencies.json` 中的 `life_account_links` 自动派生，不应直接编辑。修改能力节点后运行：

```bash
python3 tools/sync_life_account_links.py --write
```

`competency-guidance.json` 也属于派生数据。修改节点后运行：

```bash
python3 tools/build_competency_guidance.py --write
```

所有数据修改完成后重建清单；不带 `--write` 时，三个工具只检查同步状态：

```bash
python3 tools/build_manifest.py --write
```
