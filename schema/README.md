# JSON Schema

本目录用于验证图谱数据的结构一致性。Schema 只能验证字段和数据格式，不能证明能力定义在教育学上的有效性。

- `competency.schema.json`：能力节点结构
- `competencies-document.schema.json`：完整能力节点数据文件
- `dependency.schema.json`：能力关系结构
- `dependencies-document.schema.json`：完整关系数据文件
- `candidate-pool.schema.json`：候选池与选择状态
- `life-account-link.schema.json`：能力与人生课题的非因果映射
- `life-account-links-document.schema.json`：完整人生课题映射文件
- `domains.schema.json`：领域与二级领域文件
- `competency-guidance.schema.json`：观察任务与发展支持文件
- `subdomain-guidance.schema.json`：三类受众说明文件
- `framework-standards.schema.json`：外部框架引用文件
- `competency-alignments.schema.json`：能力与外部框架映射文件
- `learning-paths.schema.json`：跨领域学习路径文件
- `graph-metrics.schema.json`：图连接度与路径覆盖指标
- `manifest.schema.json`：版本、统计与文件哈希清单

当前采用 JSON Schema Draft 2020-12，并提供无第三方依赖的本地校验工具。
