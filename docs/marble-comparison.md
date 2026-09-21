# 与 Marble `os-taxonomy` 的结构化对比

比较基线：Marble `main` 仓库 README、Schema、manifest 与 PROVENANCE，检查日期 2026-09-21。

| 维度 | Marble Skill Taxonomy | Richology 青少年 AI 时代成长图谱 | 判断 |
|---|---|---|---|
| 目标 | 小学学科微主题和先修路径 | 12–18 岁 AI 创造与商业化能力、证据与实践 | 目标与本体独立 |
| 层级 | subject → domain → micro-topic | 人生课题 → 领域 → 二级领域 → competency → evidence/context | 借鉴分层思想，结构自有 |
| 节点 | 单个可教学知识／技能主题 | 可行动、可观察、可发展、可迁移的人类能力 | 定义原则不同 |
| 关系 | hard/soft prerequisite DAG | requires/supports/related_to | 借鉴依赖图，语义扩展且更谨慎 |
| 学习进阶 | 年龄范围与微主题路径 | E1–E4 情境化独立性和迁移 | Richology 自有 |
| 评价 | mastery evidence 与 assessment prompt | 强弱证据、反证提醒、S1–S4、AI 贡献声明 | Richology 明显扩展 |
| 外部对齐 | 国家课程标准映射 | UNESCO、UNICEF、DigComp、EntreComp 等覆盖面校准 | 不复制标准文本 |
| 数据工程 | JSON、Schema、manifest、校验、稳定 ID | 同类开放数据工程骨架，加候选池、版本、主张状态和人生映射 | 明确借鉴工程逻辑 |
| 隐私 | 排除个体掌握数据与嵌入 | 不发布未成年人 PII，不做排名、预测或心理测量 | 自有且更严格 |
| 许可 | ODbL + CC BY-SA，多来源 provenance | ODbL + CC BY-SA + Apache，多目录边界和 provenance | 借鉴成熟做法 |

## 结论

**是：本项目已经沿用 Marble 最有价值的“开放图谱工程逻辑”，但产出的不是 Marble 分类法的换皮版本，而是一套属于 Richology 的独立图谱。**

继承的是方法：细粒度稳定节点、显式关系、机器可读 JSON、Schema、校验、manifest、来源和多重许可。独立形成的是问题定义、四领域十二二级领域、六十项能力、四级熟练度、证据与反证、人生课题映射、AI 参与边界、候选治理和未成年人保护。

不能声称“复制了 Marble 的整个结果”：Marble 是 1,590 个小学学科主题、3,221 条先修边和多国课程标准对齐；Richology 当前是 60 个能力草案、63 条多语义关系，且尚未经跨情境和外部公开评议。两者成熟度与用途不同。

更准确的定位是：**以 Marble 证明过的开放知识图谱工程方式为参照，独立构建 Richology 的青少年 AI 时代能力本体、证据系统和应用方法论。**

## 参考

- Marble 仓库：<https://github.com/withmarbleapp/os-taxonomy>
- Marble 数据与许可说明：<https://github.com/withmarbleapp/os-taxonomy#files>
- Marble 来源边界：<https://github.com/withmarbleapp/os-taxonomy/blob/main/PROVENANCE.md>
