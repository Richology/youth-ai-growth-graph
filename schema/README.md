# JSON Schema

本目录用于验证图谱数据的结构一致性。Schema 只能验证字段和数据格式，不能证明能力定义在教育学上的有效性。

- `competency.schema.json`：能力节点结构
- `dependency.schema.json`：能力关系结构
- `candidate-pool.schema.json`：候选池与选择状态
- `life-account-link.schema.json`：能力与人生课题的非因果映射

当前采用 JSON Schema Draft 2020-12，并提供无第三方依赖的本地校验工具。
