#!/usr/bin/env python3
"""Build the accepted RFC 0001 nodes that are not yet present.

This deterministic maintainer tool keeps the compact editorial source below and
writes the canonical formatted graph files. It is idempotent.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

# id, Chinese name, English name, Chinese definition, English definition,
# three observable behaviours, distinguishing boundary.
SPECS = [
 ("AI-BND-003","说明 AI 角色与来源","Explain AI Roles and Provenance","能够向相关者清楚说明任务中使用了何种 AI、AI 产生了哪些内容、人的关键贡献以及结果来源和限制。","Explain what AI was used, what it produced, the essential human contribution, and the provenance and limitations of a result.",["标明任务中 AI 参与的环节和生成内容。","区分人的目标、选择、核验和修改。","在分享结果时提供适合受众的来源与限制说明。"],"侧重透明说明，不等同于完整评价输出质量。"),
 ("AI-BND-004","设置人工监督点","Set Human Oversight Points","能够根据任务风险识别不能自动交由 AI 决定的关键节点，安排有权限且有能力的人进行检查、批准或接管。","Identify decisions that should not be delegated to AI and arrange capable, authorized human review, approval, or intervention according to risk.",["标出影响安全、权利或重要结果的决策点。","说明由谁在何时依据什么标准检查或接管。","监督失效时暂停流程并升级求助。"],"不把形式上的人工点击视为有效监督。"),
 ("AI-BND-005","保护输入中的敏感信息","Protect Sensitive Information in AI Inputs","能够识别不应直接输入 AI 服务的个人、机密和受限信息，通过删除、替换、概括或获准环境完成任务。","Recognize personal, confidential, and restricted information that should not be entered into AI services and use deletion, substitution, summarization, or approved environments.",["在提交前检查材料中的身份、位置和机密信息。","采用数据最小化、匿名化或虚构替代信息。","不确定时停止输入并向适当成人或负责人求助。"],"侧重输入环节，不替代完整的数据治理。"),
 ("AI-COL-003","拆解 AI 辅助任务","Decompose AI-Assisted Tasks","能够把复杂目标拆成适合人或 AI 承担的子任务，明确顺序、接口、检查点和最终整合责任。","Decompose a complex goal into human- and AI-suitable subtasks with sequence, interfaces, checkpoints, and responsibility for integration.",["识别需要创造判断、资料处理和人工负责的不同环节。","为子任务规定输入、输出和检查标准。","根据中间结果调整顺序与分工并整合成果。"],"不等同于把所有步骤都交给 AI。"),
 ("AI-COL-004","设计并迭代指令","Design and Iterate Instructions","能够根据目标和评价标准编写清晰指令，通过小规模试验观察失败模式并有针对性地调整。","Write clear instructions from goals and criteria, observe failure modes through small trials, and revise instructions purposefully.",["把目标、受众、约束和输出标准写入指令。","比较修改前后的结果并定位变化原因。","保留有效部分并避免无目的反复尝试。"],"不以提示词长度、技巧数量或单次惊艳结果评价能力。"),
 ("AI-COL-005","记录人机贡献","Document Human and AI Contributions","能够在项目过程中记录 AI 生成、人的选择与修改、外部素材和最终责任，使贡献可以被检查和解释。","Document AI generation, human choices and edits, external materials, and final responsibility so contributions can be inspected and explained.",["持续记录关键生成、选择、修改和舍弃。","标注外部素材、版本和 AI 参与方式。","能够从记录重建重要决策而非事后猜测。"],"侧重过程可追溯性，不等同于简单声明使用过 AI。"),
 ("AI-JUD-003","追溯来源与主张","Trace Sources and Claims","能够把 AI 输出中的重要主张追溯到可检查来源，判断来源是否真实、相关、及时并真正支持该主张。","Trace important AI-generated claims to inspectable sources and judge whether sources are authentic, relevant, current, and genuinely supportive.",["把可核验主张与意见、建议或未知内容分开。","打开原始来源并检查作者、日期、上下文和证据。","删除或降级无法追溯的主张并说明原因。"],"有链接不等于来源已经支持主张。"),
 ("AI-JUD-004","比较备选输出","Compare Alternative Outputs","能够用事先确定的标准比较多份 AI 或人类方案，识别各自优势、缺陷和适用条件，再作出可解释选择。","Compare multiple AI or human alternatives against prior criteria, identify strengths, weaknesses, and conditions, and make an explainable choice.",["在查看结果前明确重要标准和权重。","使用相同情境比较多个方案而非只挑喜欢的。","说明选择、组合或拒绝方案的依据。"],"不把多数结果一致当作真实性证明。"),
 ("AI-JUD-005","表达置信度与不确定性","Communicate Confidence and Uncertainty","能够区分已确认、较可信、推测和未知内容，用与证据相称的语言表达把握程度和后续核验需要。","Distinguish confirmed, plausible, speculative, and unknown content and communicate confidence and further verification needs proportionately.",["标出结论依赖的证据与关键假设。","避免把可能性写成确定事实。","说明哪些新信息会改变当前判断。"],"不要求给出虚假的精确概率。"),
 ("BIZ-NED-003","观察行为与情境","Observe Behavior and Context","能够在取得适当同意的前提下观察真实任务中的行为、环境与替代做法，记录事实并延后解释。","Observe behavior, environment, and workarounds in real tasks with appropriate consent, record facts, and postpone interpretation.",["明确观察目的、边界和同意方式。","记录行为、触发条件、环境限制和替代方案。","把观察事实、解释和待验证问题分开。"],"不进行隐蔽跟踪或把单次行为解释为固定特征。"),
 ("BIZ-NED-004","综合需求证据","Synthesize Needs Evidence","能够把访谈、观察、反馈和已有资料放在一起，识别重复模式、重要差异、反例与证据空白。","Combine interviews, observations, feedback, and existing materials to identify patterns, differences, counterexamples, and evidence gaps.",["按来源整理证据并保留可追溯性。","同时呈现共同模式、少数差异和反例。","说明结论强度以及仍需补充的信息。"],"不把相似表达简单计数为确定需求。"),
 ("BIZ-NED-005","定义问题与机会","Frame Problems and Opportunities","能够基于证据描述具体对象、情境、阻碍和期望进展，形成开放但可行动的问题与机会陈述。","Frame an actionable yet open problem and opportunity from evidence about people, context, barriers, and desired progress.",["说明对象、情境、当前做法和具体阻碍。","把证据支持的事实与待验证假设分开。","避免在问题陈述中预设唯一解决方案。"],"问题定义不是宣传口号，也不是解决方案名称。"),
 ("BIZ-PRO-003","明确价值主张","Clarify the Value Proposition","能够说明方案为具体对象在特定情境中带来什么进展、为何优于现有替代，并把主张写成可验证假设。","Explain the progress a solution offers specific people in context, why it may outperform alternatives, and express the claim as a testable hypothesis.",["对应具体需求说明预期改变。","识别使用者当前采用的替代方案和切换成本。","把价值表述转化为可被真实反馈挑战的假设。"],"不等同于口号、功能清单或未经验证的优势宣称。"),
 ("BIZ-PRO-004","确定产品范围与优先级","Set Product Scope and Priorities","能够依据验证目标、用户价值、依赖和资源限制选择当前版本必须做、暂缓和不做的内容。","Choose what a current version must include, defer, or exclude based on learning goals, user value, dependencies, and resource constraints.",["建立与当前目标相关的优先级标准。","明确最小范围和不做清单。","范围变化时说明代价并重新确认目标。"],"不把功能数量或工作量当作价值。"),
 ("BIZ-PRO-005","设计可访问的使用体验","Design Accessible User Experiences","能够考虑不同年龄、能力、设备和环境条件，使目标使用者能够理解、操作并在需要时获得替代方式。","Design so intended users across ages, abilities, devices, and contexts can understand, operate, and access alternatives when needed.",["识别影响理解、操作和感知的使用条件。","与不同使用者测试关键流程和失败情境。","根据障碍提供清晰提示、容错和替代路径。"],"不要求掌握全部专业无障碍标准，但必须避免只为自己设计。"),
 ("BIZ-VAL-003","选择验证指标","Choose Validation Indicators","能够根据假设选择能够反映真实行为、结果或交换意愿的指标，并说明指标的局限和可能被误读之处。","Choose indicators that reflect real behavior, outcomes, or willingness to exchange, and explain their limitations and possible misinterpretations.",["让指标直接对应待验证假设。","同时考虑行为、结果和必要的定性解释。","识别虚荣指标、代理偏差和短期效应。"],"不以容易收集或数值较大的指标代替真正价值。"),
 ("BIZ-VAL-004","解释冲突证据","Interpret Conflicting Evidence","能够面对意见、行为和指标之间的不一致，检查来源、样本与情境差异，形成带条件的解释而非挑选有利结果。","Examine source, sample, and context differences when opinions, behavior, and indicators conflict, producing conditional interpretations rather than cherry-picking.",["并列呈现支持和反对假设的证据。","检查样本、测量和情境能否解释差异。","说明当前不能决定的事项和下一步验证。"],"不通过简单平均消除重要差异。"),
 ("BIZ-VAL-005","依据验证决定下一步","Decide Next Steps from Validation","能够依据预设标准和实际证据决定继续、修改、缩小、暂停或放弃，并明确下一步要减少的不确定性。","Use prior criteria and evidence to continue, modify, narrow, pause, or stop, and identify the next uncertainty to reduce.",["把决定与原假设、指标和证据对应。","考虑沉没成本之外的未来价值和风险。","记录决定、保留条件和下一轮行动。"],"继续项目不是默认正确答案，停止也不等于失败。"),
 ("PRO-PJM-003","估算任务与资源","Estimate Tasks and Resources","能够依据任务范围、历史信息和未知因素估算时间、人员、材料与支持需求，并保留适当余量。","Estimate time, people, materials, and support from scope, prior information, and uncertainty, including appropriate contingency.",["把大任务拆成可估算部分并说明假设。","参考实际记录而非只凭愿望给出时间。","执行后比较估算与实际并校准。"],"估算是可更新判断，不是必须兑现的精确承诺。"),
 ("PRO-PJM-004","协调里程碑与依赖","Coordinate Milestones and Dependencies","能够识别任务交接和外部依赖，设置可检查里程碑，及时同步阻塞并调整关键路径。","Identify handoffs and external dependencies, set inspectable milestones, surface blockers early, and adjust the critical path.",["标出任务间先后、交接和等待关系。","用可检查交付物定义里程碑。","阻塞发生时通知受影响者并协商调整。"],"不等同于制作一张静态甘特图。"),
 ("PRO-PJM-005","完成项目收尾与复盘","Close and Review Projects","能够确认交付与未完成事项，整理文件和责任，回顾目标、过程、结果与经验，并把结论转化为后续行动。","Confirm delivery and open items, organize files and responsibilities, review goals, process, outcomes, and lessons, and turn conclusions into follow-up action.",["与相关者确认交付、验收和遗留问题。","保存必要资料并关闭不再需要的访问权限。","形成基于事实的复盘和可追踪改进行动。"],"复盘不应只庆祝成功或追究个人责任。"),
 ("PRO-COM-003","撰写可行动工作文档","Write Actionable Work Documents","能够为明确对象和用途撰写结构清晰、事实可追溯、责任与下一步明确的工作文档。","Write clear, traceable work documents for a defined audience and purpose, with ownership and next actions explicit.",["在开头说明目的、读者和需要的行动。","区分事实、判断、决定和待确认事项。","标注负责人、期限、来源和版本。"],"不以篇幅、术语密度或排版华丽判断专业性。"),
 ("PRO-COM-004","呈现并解释专业判断","Present and Explain Professional Judgments","能够围绕受众关心的问题呈现结论、证据、取舍和限制，并在质询中澄清或修正判断。","Present conclusions, evidence, trade-offs, and limitations around audience concerns and clarify or revise judgments under questioning.",["根据受众选择必要信息和呈现顺序。","把结论与证据、假设和限制连接。","回应问题时承认未知并记录需要跟进的事项。"],"不把说服力建立在夸大、隐瞒限制或操纵情绪上。"),
 ("PRO-COM-005","主持有效会议","Facilitate Effective Meetings","能够判断是否需要会议，设置目标与议程，促进适当参与，并形成决定、负责人和后续记录。","Decide whether a meeting is needed, set objectives and agenda, support appropriate participation, and capture decisions, owners, and follow-up.",["会前说明目的、材料和需要作出的决定。","控制节奏并让相关角色有表达机会。","会后发布决定、未决问题、负责人和期限。"],"不以会议时长、发言次数或主持者控制程度衡量效果。"),
 ("PRO-SEL-003","设定并修订个人目标","Set and Revise Personal Goals","能够把长期愿望转化为与当前条件相符的阶段目标、成功标准和近期行动，并根据证据修订。","Turn longer-term intentions into stage-appropriate goals, success criteria, and near-term actions, revising them from evidence.",["说明目标与自身价值、责任和现实条件的关系。","把成功状态写成可观察标准和近期行动。","进展或条件变化时调整目标而非机械坚持。"],"不要求过早确定固定职业或人生方向。"),
 ("PRO-SEL-004","主动求助并运用资源","Seek Help and Use Resources","能够识别自身能力与权限边界，选择适当的人、工具或材料提出具体求助，并把获得的支持转化为自己的行动。","Recognize capability and authority limits, seek specific help from suitable people, tools, or materials, and turn support into personal action.",["说明已经尝试、具体阻碍和需要的支持。","根据问题风险选择同伴、教师、监护人或专业资源。","获得帮助后确认理解、执行并回报结果。"],"求助不是把责任转交给他人，也不是能力不足的标签。"),
 ("PRO-SEL-005","从失败中学习并迁移","Learn and Transfer from Failure","能够把未达预期的经历分解为条件、行动和结果，提炼可检验经验，并在新情境中调整使用。","Analyze unmet outcomes through conditions, actions, and results, derive testable lessons, and adapt them in new contexts.",["区分可控行动、外部条件和偶然结果。","形成具体、有限、可验证的经验而非人格结论。","在另一任务中尝试经验并根据差异调整。"],"不美化伤害、过度消耗或本可避免的失败。"),
 ("SOC-AWR-003","理解差异化视角","Understand Diverse Perspectives","能够基于当事人的表达和情境理解不同经验与判断，区分理解、同意和代替他人发言。","Understand different experiences and judgments from people's own accounts and contexts, distinguishing understanding, agreement, and speaking for others.",["主动接触与自己不同的可靠视角。","复述他人观点并请对方确认理解。","在决策中说明差异如何被考虑而不抹平。"],"不把群体身份当作个人观点的自动答案。"),
 ("SOC-AWR-004","识别社会规范与情境","Recognize Social Norms and Context","能够识别不同社区和场景中的明示规则、非正式规范与角色期待，判断其作用、冲突和可质疑之处。","Identify formal rules, informal norms, and role expectations across communities and contexts, judging their functions, conflicts, and contestability.",["区分法律、平台规则、团队约定和非正式习惯。","观察规范对不同角色的实际影响。","不确定或冲突时询问、协商或提出改进。"],"理解规范不代表无条件服从不公平做法。"),
 ("SOC-AWR-005","评估非预期影响","Assess Unintended Impacts","能够在行动前后考虑对不同角色、公共资源和长期行为可能产生的间接或非预期影响，并据此调整。","Consider indirect or unintended effects on different people, public resources, and longer-term behavior before and after action, and adjust accordingly.",["绘制直接结果之外的可能连锁影响。","寻找可能受损但未参与决定的角色。","监测实际影响并在出现伤害时修正或补救。"],"不要求预测所有后果，但必须处理合理可预见风险。"),
 ("SOC-COL-003","建立团队协作约定","Establish Team Agreements","能够与成员共同确定目标、角色、沟通、决策、资料和冲突处理规则，并在实践中维护和修订。","Co-create and maintain team agreements on goals, roles, communication, decisions, materials, and conflict handling.",["让成员共同讨论并确认约定。","使角色、响应方式、资料权限和升级路径清楚。","出现新情况时依据经验修订约定。"],"约定不应只是教师提供且成员从未使用的表格。"),
 ("SOC-COL-004","维护共享责任","Maintain Shared Accountability","能够让团队承诺和进展保持可见，在成员遇到阻碍时相互支持，并公平处理失约而非掩盖或指责。","Keep commitments and progress visible, support members facing blockers, and handle missed commitments fairly without concealment or blame.",["定期同步承诺、进展、风险和所需支持。","区分需要帮助、重新协商和应承担责任的情形。","根据影响共同修复交付并更新约定。"],"共享责任不等于替表现不佳者无限承担工作。"),
 ("SOC-COL-005","修复协作中的信任","Repair Trust in Collaboration","能够在误解、失约或伤害发生后承认影响、倾听相关者、采取与责任相称的补救，并通过后续行动重建可验证的可靠性。","After misunderstanding, missed commitments, or harm, acknowledge impact, listen, make proportionate repair, and rebuild reliability through follow-through.",["清楚描述行为与影响而非只辩解意图。","询问受影响者需要的修复并说明自身可承担范围。","完成补救承诺并观察信任是否逐步恢复。"],"道歉不自动要求对方原谅或恢复原关系。"),
 ("SOC-RUL-003","尊重版权与正确署名","Respect Copyright and Attribution","能够识别作品、数据和代码的权利与许可，选择允许的使用方式，保留来源并按要求署名。","Identify rights and licences for works, data, and code, choose permitted uses, preserve provenance, and attribute as required.",["查找素材的作者、来源、许可和使用条件。","区分引用、改编、公共领域和无法确认授权。","在作品中保留清晰署名与变更说明。"],"署名不自动获得使用许可，教育用途也不自动无限制。"),
 ("SOC-RUL-004","安全地公开发布","Publish Safely","能够在公开发布前检查身份暴露、位置、声誉、版权、平台规则和受众扩散风险，并选择保护措施或停止发布。","Before public release, check identity exposure, location, reputation, copyright, platform rules, audience spread, and choose safeguards or stop publication.",["检查正文、图片、声音和元数据中的可识别信息。","获得相关人员的适当同意并考虑内容脱离原语境后的影响。","设置必要的访问、评论或删除措施并保留应急方式。"],"获得一次同意不代表可以改变用途或永久公开。"),
 ("SOC-RUL-005","披露 AI 使用并保留问责记录","Disclose AI Use and Preserve Accountability","能够按情境要求披露 AI 参与，保存关键来源、核验和审批记录，并确保有明确的人对最终发布和后果负责。","Disclose AI involvement as context requires, preserve key provenance, verification, and approval records, and ensure a named human owns final release and consequences.",["根据受众、平台和任务要求说明 AI 使用程度。","保存足以复查关键内容来源与人工决定的记录。","指定最终负责人并建立错误更正或撤回路径。"],"披露不是免责条款，也不替代核验和补救。"),
]

RESEARCH = {
    "AI": ("UNESCO AI Competency Framework for Students (2024)", "https://www.unesco.org/en/articles/ai-competency-framework-students"),
    "BIZ": ("European Commission JRC EntreComp", "https://joint-research-centre.ec.europa.eu/scientific-activities/key-competences-lifelong-learning/entrecomp-entrepreneurship-competence-framework/competence-areas-and-learning-progress_en"),
    "PRO": ("European Commission JRC EntreComp", "https://joint-research-centre.ec.europa.eu/scientific-activities/key-competences-lifelong-learning/entrecomp-entrepreneurship-competence-framework/competence-areas-and-learning-progress_en"),
    "SOC": ("UNICEF Guidance on AI and Children, Version 3", "https://www.unicef.org/innocenti/reports/policy-guidance-ai-children"),
}

LIFE = {
    "AI": [("wealth", "可靠的人机判断可能支持更安全有效的价值创造。")],
    "BIZ": [("wealth", "理解、构建和验证价值可能支持可持续的价值交换。")],
    "PRO": [("wealth", "可靠的工作实践可能支持长期价值交付。"), ("health", "可持续的工作方式可能减少过度消耗。")],
    "SOC": [("relationships", "理解规则与他人并负责任地协作可能支持可信关系。")],
}


def build(spec: tuple) -> dict:
    node_id, zh, en, dzh, den, behaviors, boundary = spec
    domain, code, _ = node_id.split("-")
    source, url = RESEARCH[domain]
    return {
        "id": node_id, "version": "0.1.0", "status": "draft",
        "name": {"zh": zh, "en": en}, "domain_id": domain,
        "subdomain_id": f"{domain}.{code}", "definition": {"zh": dzh, "en": den},
        "boundaries": [boundary, "不等同于记忆术语、照搬模板或只完成一次任务。", "评价时应结合情境、过程与学习者实际承担的判断。"],
        "observable_behaviors": behaviors,
        "proficiency_descriptors": {
            "E1": f"在示例和明确步骤支持下，能识别基本要求并尝试{zh}。",
            "E2": f"借助模板、检查清单或同伴协作，能完成一次{zh}并解释基本选择。",
            "E3": f"能在熟悉情境中独立{zh}，检查结果并根据反馈作出调整。",
            "E4": f"能在新的复杂情境中迁移和改进{zh}的方法，权衡影响并说明决策。",
        },
        "evidence_guidance": {
            "strong": [f"包含情境、学习者行动、结果、反馈与调整的{zh}过程记录。", "能解释关键选择，并在新的材料或情境中再次应用。"],
            "weak": ["只有最终作品、术语复述或由 AI 直接生成的答案。", "完全依赖教师、同伴或模板完成，无法说明自己的判断。"],
            "cautions": ["一次成功不足以证明稳定能力；资源、语言、健康与参与机会也会影响表现。"],
        },
        "life_account_links": [{"account": account, "relation": "may_contribute_to", "rationale": rationale} for account, rationale in LIFE[domain]],
        "claim_status": "observation",
        "sources": [{"type": "practice", "citation": "Richology 青少年 AI 创造与项目课程实践总结"}, {"type": "research", "citation": source, "url": url}],
        "change_log": [{"version": "0.1.0", "date": "2026-09-21", "summary": "Initial draft node accepted by RFC 0001."}],
    }


def main() -> None:
    competency_path = DATA / "competencies.json"
    competency_doc = json.loads(competency_path.read_text(encoding="utf-8"))
    known = {item["id"] for item in competency_doc["competencies"]}
    additions = [build(spec) for spec in SPECS if spec[0] not in known]
    competency_doc["competencies"].extend(additions)
    competency_path.write_text(json.dumps(competency_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    dependency_path = DATA / "dependencies.json"
    dependency_doc = json.loads(dependency_path.read_text(encoding="utf-8"))
    rel_ids = {item["id"] for item in dependency_doc["relationships"]}
    next_number = max(int(value.split("-")[1]) for value in rel_ids) + 1
    for spec in SPECS:
        node_id = spec[0]
        if node_id not in {item["id"] for item in additions}:
            continue
        domain, code, _ = node_id.split("-")
        dependency_doc["relationships"].append({
            "id": f"REL-{next_number:04d}", "source_id": node_id,
            "target_id": f"{domain}-{code}-001", "type": "supports",
            "rationale": f"“{spec[1]}”为该二级领域的综合基础能力提供一种可单独教学、观察和反馈的具体实践。",
            "contexts": ["项目式学习", "真实或近真实任务"], "status": "draft",
            "version": "0.1.0", "sources": ["RFC 0001 editorial decision"],
        })
        next_number += 1
    dependency_path.write_text(json.dumps(dependency_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    links = []
    for node in competency_doc["competencies"]:
        for link in node["life_account_links"]:
            links.append({"competency_id": node["id"], **link})
    (DATA / "life-account-links.json").write_text(json.dumps({
        "schema_version": "0.1.0", "status": "draft",
        "source_of_truth": "Generated from competencies.json; do not edit directly.",
        "links": links,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Added {len(additions)} competencies and {len(additions)} relationships.")


if __name__ == "__main__":
    main()
