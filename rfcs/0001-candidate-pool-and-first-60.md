# RFC 0001：从 72 项候选池形成首批 60 个能力节点

- 状态：Accepted for v0.1 draft
- 日期：2026-09-21
- 讨论对象：能力节点范围、粒度与首批选择

## 背景

项目需要一组足以支撑课程映射、又不会把工具操作和人格标签混入图谱的首批节点。候选池采用 12 个二级领域各 6 项的对称结构，共 72 项；v0.1 从每个二级领域选择 5 项，共 60 项。

候选池真源为 [`data/candidate-pool.json`](../data/candidate-pool.json)。RFC 解释选择规则，不复制维护另一份名单。

## 决策

首批节点必须同时满足：以人的行动为中心；可观察；可发展；可跨工具迁移；与相邻节点边界可说明；适合 12–18 岁学习者的经验和责任范围；能够形成过程、产出、解释、反馈或迁移证据。

每个二级领域暂选前 5 项，第 6 项标记为 `deferred`。延期不等于否定；它表示当前存在粒度过大、技术门槛较高、过度依赖司法辖区、容易绑定具体工具，或超出青少年责任范围的问题。

## 节点粒度

- 综合基础节点描述该二级领域的核心行动。
- 后续节点下钻到可单独教学和观察的判断或实践。
- 两个节点若总是共享行为、证据和前置关系，应优先合并。
- 一个节点若同时包含可独立教学的多个动作，应优先拆分。

## 认识论状态

首批 60 个节点均为 `draft`，不代表教育学有效性已经得到验证。实践经验用于说明形成过程；外部框架用于校准覆盖面和边界；只有直接支持具体主张的研究才标为 `evidence`。

## 外部校准依据

- UNESCO, *AI Competency Framework for Students* (2024): <https://www.unesco.org/en/articles/ai-competency-framework-students>
- UNICEF, *Guidance on AI and Children* (Version 3, 2025): <https://www.unicef.org/innocenti/reports/policy-guidance-ai-children>
- European Commission JRC, *DigComp*: <https://joint-research-centre.ec.europa.eu/scientific-activities/key-competences-lifelong-learning/digital-competence-framework-digcomp/all-editions-digcomp-and-related-jrc-publications_en>
- European Commission JRC, *EntreComp*: <https://joint-research-centre.ec.europa.eu/scientific-activities/key-competences-lifelong-learning/entrecomp-entrepreneurship-competence-framework/competence-areas-and-learning-progress_en>
- NIST, *AI Risk Management Framework 1.0* (2023): <https://doi.org/10.6028/NIST.AI.100-1>

这些框架不是本图谱的上位标准，也不被逐项复制。它们用于检查是否遗漏人类能动性、安全、公平、价值创造、协作、自我调节与社会责任等重要维度。

## 后果与复审

首批 60 项完成后，应由教育、AI、青少年发展、创业、隐私与伦理等不同背景的审阅者检查重叠、缺失、年龄适切性和证据可行性。任何节点仍可重命名、合并或拆分，但已公开 ID 不得复用。

当延期项获得清晰教学情境、适龄边界和可观察证据后，可通过新 RFC 纳入；也可在证据不足时继续延期或废弃。
