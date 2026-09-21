#!/usr/bin/env python3
"""Build website-ready evidence and developmental guidance for every node."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "competencies.json"
TARGET = ROOT / "data" / "competency-guidance.json"

ADULT_RESPONSIBILITY = {
    "AI.BND": "成人负责高风险用途、受限数据、工具许可和最终审批；青少年可以识别风险、暂停并求助。",
    "AI.COL": "成人确保工具与材料可安全使用；青少年负责说明自己的目标、选择、核验和修改。",
    "AI.JUD": "医疗、法律、财务与安全结论必须由合格成人或专业人员核验，不能交由青少年最终决定。",
    "BIZ.NED": "成人负责研究许可、安全边界与敏感对象保护；青少年不进入危险或私密场景取证。",
    "BIZ.PRO": "成人负责产品安全、采购、合同和公开部署；青少年可在低风险原型中作设计取舍。",
    "BIZ.VAL": "成人负责招募、同意、数据保护和真实交易边界；青少年参与低风险测试与证据解释。",
    "PRO.PJM": "成人提供现实资源与制度支持，并承担机构依赖；青少年只对其可控制的承诺负责。",
    "PRO.COM": "成人提供安全表达与申诉渠道；不以口音、外向程度或成人职场话语评价青少年。",
    "PRO.SEL": "成人保障休息、健康、求助与退出权；自我管理不能替代照护和制度责任。",
    "SOC.AWR": "成人处理歧视、伤害和制度问题；青少年可以识别影响，但不独自承担系统改变责任。",
    "SOC.COL": "成人对欺凌、骚扰和权力滥用及时介入；协作评价不能强迫受影响者参与修复。",
    "SOC.RUL": "成人负责法律判断、平台治理、发布审批和严重事件处置；青少年学习识别、记录与求助。",
}


def build_document() -> dict:
    document = json.loads(SOURCE.read_text(encoding="utf-8"))
    guidance = []
    for node in document["competencies"]:
        guidance.append(
            {
                "competency_id": node["id"],
                "age_policy": "不按年龄固定能力等级；结合经验、支持条件、任务风险和迁移表现判断。",
                "experience_progression": [
                    "在示例、分步说明或成人支持下尝试",
                    "借助清单、模板或同伴协作完成",
                    "在熟悉且低风险的情境中独立完成",
                    "在新的复杂情境中迁移、权衡并说明决定",
                ],
                "adult_responsibility": ADULT_RESPONSIBILITY[node["subdomain_id"]],
                "evidence_task": {
                    "setup": "使用虚构、合成、公开或充分去标识化的材料，安排低风险、可逆的任务。",
                    "behaviors_to_elicit": node["observable_behaviors"],
                    "artifacts_to_keep": node["evidence_guidance"]["strong"],
                },
                "observer_questions": [
                    "学习者实际作出了哪些选择和判断？",
                    "哪些结果来自 AI、同伴、教师或其他成人？",
                    "学习者能否解释理由、限制以及需要求助的地方？",
                    "换一种材料或情境后，相关行为能否再次出现？",
                ],
                "not_sufficient_evidence": node["evidence_guidance"]["weak"],
                "fairness_cautions": node["evidence_guidance"]["cautions"],
                "boundaries": node["boundaries"],
            }
        )
    return {
        "schema_version": "0.1.0",
        "status": "draft",
        "source_of_truth": "Generated from competencies.json plus subdomain adult-responsibility rules; do not edit directly.",
        "guidance": guidance,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    expected = build_document()
    if args.write:
        TARGET.write_text(json.dumps(expected, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {TARGET.relative_to(ROOT)} with {len(expected['guidance'])} guidance records.")
        return 0
    if not TARGET.exists() or json.loads(TARGET.read_text(encoding="utf-8")) != expected:
        print("competency-guidance.json is out of sync; run with --write.")
        return 1
    print(f"Competency guidance is synchronized: {len(expected['guidance'])} records.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
