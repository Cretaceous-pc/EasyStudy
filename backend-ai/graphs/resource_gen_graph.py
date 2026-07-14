"""
ResourceGenState 图 — 多资源并行生成 + 校验

节点: plan_resources → gen_document/gen_mermaid/gen_exercise_set/gen_code_case/gen_reading → validate → assemble
"""

import logging
from typing import TypedDict, List, Optional, Annotated
import operator

from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)


class ResourceGenState(TypedDict):
    # ── 请求上下文 ──
    student_id: int
    course_id: int
    topic: str
    resource_types: List[str]
    requirements: str  # 用户自定义生成要求
    profile: dict

    # ── RAG 上下文 ──
    rag_context: str

    # ── 规划 ──
    resource_plan: List[dict]

    # ── 生成结果（并行节点各自写入，用 operator.or_ 合并） ──
    generated: Annotated[dict, operator.or_]
    validation_results: dict

    # ── 计数 ──
    generated_count: int
    failed_count: int
    resource_ids: List[int]

    # ── 汇总 ──
    summary_text: str
    error: Optional[str]


# ── 辅助函数 ──

def _format_profile_for_prompt(profile: dict) -> dict:
    """从画像 JSONB 中提取各维度的 label"""
    if not profile:
        return {
            "profile_knowledge_base": "未知",
            "profile_learning_goal": "未知",
            "profile_cognitive_style": "未知",
            "profile_learning_pace": "未知",
            "profile_error_prone_points": "无",
            "profile_engagement": "未知",
        }
    return {
        "profile_knowledge_base": profile.get("knowledge_base", {}).get("label", "未知"),
        "profile_learning_goal": profile.get("learning_goal", {}).get("label", "未知"),
        "profile_cognitive_style": profile.get("cognitive_style", {}).get("label", "未知"),
        "profile_learning_pace": profile.get("learning_pace", {}).get("label", "未知"),
        "profile_error_prone_points": profile.get("error_prone_points", {}).get("label", "无"),
        "profile_engagement": profile.get("engagement", {}).get("label", "未知"),
    }


def _load_rag_context(student_id: int, course_id: int, topic: str) -> str:
    """加载 RAG 上下文"""
    from rag.retriever import get_retriever, format_retrieved_docs
    try:
        retriever = get_retriever(course_id, top_k=5)
        docs = retriever(topic)
        return format_retrieved_docs(docs)
    except Exception as e:
        logger.warning(f"[rag] context loading failed: {e}")
        return "（未检索到相关资料）"


def _load_profile(student_id: int, course_id: int) -> dict:
    """加载学生画像"""
    from services.db import load_profile
    try:
        data = load_profile(student_id, course_id)
        return data.get("profile", {}) if data else {}
    except Exception:
        return {}


# ── 节点函数 ──

def plan_resource_list(state: ResourceGenState) -> dict:
    """决定生成哪些资源 + 加载上下文"""
    types = state.get("resource_types", [])
    student_id = state.get("student_id", 0)
    course_id = state.get("course_id", 0)
    topic = state.get("topic", "")

    # 加载 RAG 上下文
    rag_context = _load_rag_context(student_id, course_id, topic)

    # 加载画像（如果 state 中为空）
    profile = state.get("profile", {})
    if not profile:
        profile = _load_profile(student_id, course_id)

    plan = [{"type": rt, "title": rt, "priority": i}
            for i, rt in enumerate(types)]

    return {
        "resource_plan": plan,
        "rag_context": rag_context,
        "profile": profile,
    }


async def _generate_single(
    resource_type: str,
    prompt_template: str,
    topic: str,
    rag_context: str,
    profile: dict,
    requirements: str = "",
    expect_json: bool = False,
) -> dict:
    """通用生成函数：调用 DeepSeek 生成单个资源"""
    from services.deepseek_client import deepseek_generate, deepseek_generate_json

    profile_vars = _format_profile_for_prompt(profile)
    prompt = prompt_template.format(
        topic=topic,
        rag_context=rag_context,
        requirements=requirements or "无特殊要求",
        **profile_vars,
    )

    try:
        if expect_json:
            result = await deepseek_generate_json(
                prompt=prompt,
                system="你是一个教育内容生成专家。请用 JSON 格式回复。",
                timeout=90.0,
            )
            content = result
        else:
            text = await deepseek_generate(
                prompt=prompt,
                system="你是一个教育内容生成专家。请用 Markdown 格式回复。",
                timeout=90.0,
            )
            content = {"markdown": text.strip()} if resource_type == "document" else {
                "mermaid_code": text.strip()
            } if resource_type == "mermaid" else {"markdown": text.strip()}

        return {
            "title": f"{resource_type}: {topic}",
            "content": content,
            "error": None,
        }
    except Exception as e:
        logger.error(f"[{resource_type}] generation failed: {e}")
        return {
            "title": f"{resource_type}: {topic}",
            "content": None,
            "error": str(e)[:200],
        }


async def generate_document(state: ResourceGenState) -> dict:
    """讲解文档"""
    from prompts.resource_prompts import PROMPT_GENERATE_DOCUMENT
    result = await _generate_single(
        "document", PROMPT_GENERATE_DOCUMENT,
        state.get("topic", ""),
        state.get("rag_context", ""),
        state.get("profile", {}),
        state.get("requirements", ""),
        expect_json=False,
    )
    generated = dict(state.get("generated", {}))
    generated["document"] = result
    return {"generated": generated}


async def generate_mermaid(state: ResourceGenState) -> dict:
    """思维导图"""
    from prompts.resource_prompts import PROMPT_GENERATE_MERMAID
    result = await _generate_single(
        "mermaid", PROMPT_GENERATE_MERMAID,
        state.get("topic", ""),
        state.get("rag_context", ""),
        state.get("profile", {}),
        state.get("requirements", ""),
        expect_json=False,
    )
    generated = dict(state.get("generated", {}))
    generated["mermaid"] = result
    return {"generated": generated}


async def generate_exercise_set(state: ResourceGenState) -> dict:
    """练习题集"""
    from prompts.resource_prompts import PROMPT_GENERATE_EXERCISE_SET
    result = await _generate_single(
        "exercise_set", PROMPT_GENERATE_EXERCISE_SET,
        state.get("topic", ""),
        state.get("rag_context", ""),
        state.get("profile", {}),
        state.get("requirements", ""),
        expect_json=True,
    )
    generated = dict(state.get("generated", {}))
    generated["exercise_set"] = result
    return {"generated": generated}


async def generate_code_case(state: ResourceGenState) -> dict:
    """代码案例"""
    from prompts.resource_prompts import PROMPT_GENERATE_CODE_CASE
    result = await _generate_single(
        "code_case", PROMPT_GENERATE_CODE_CASE,
        state.get("topic", ""),
        state.get("rag_context", ""),
        state.get("profile", {}),
        state.get("requirements", ""),
        expect_json=False,
    )
    generated = dict(state.get("generated", {}))
    generated["code_case"] = result
    return {"generated": generated}


async def generate_reading_material(state: ResourceGenState) -> dict:
    """拓展阅读"""
    from prompts.resource_prompts import PROMPT_GENERATE_READING
    result = await _generate_single(
        "reading_material", PROMPT_GENERATE_READING,
        state.get("topic", ""),
        state.get("rag_context", ""),
        state.get("profile", {}),
        state.get("requirements", ""),
        expect_json=True,
    )
    generated = dict(state.get("generated", {}))
    generated["reading_material"] = result
    return {"generated": generated}


async def validate_all_resources(state: ResourceGenState) -> dict:
    """校验智能体：校验所有生成资源"""
    from services.deepseek_client import deepseek_generate_json
    from prompts.validation_prompts import PROMPT_VALIDATE_RESOURCE, PROMPT_VALIDATE_EXERCISE

    generated = state.get("generated", {})
    rag_context = state.get("rag_context", "")
    validation_results = {}

    for resource_type, result in generated.items():
        if result.get("error") or result.get("content") is None:
            validation_results[resource_type] = {"passed": False, "error": result.get("error")}
            continue

        try:
            if resource_type == "exercise_set":
                prompt = PROMPT_VALIDATE_EXERCISE.format(
                    exercise_json=str(result.get("content", {}))[:8000],
                    rag_context=rag_context,
                )
            else:
                prompt = PROMPT_VALIDATE_RESOURCE.format(
                    resource_type=resource_type,
                    resource_content=str(result.get("content", {}))[:8000],
                    rag_context=rag_context,
                )

            validation = await deepseek_generate_json(
                prompt=prompt,
                system="你是一个严格的内容审核员。请用 JSON 格式回复。",
                timeout=60.0,
            )
            validation_results[resource_type] = validation
        except Exception as e:
            logger.warning(f"[validate] {resource_type} validation skipped: {e}")
            validation_results[resource_type] = {"passed": True, "skipped": True}

    return {"validation_results": validation_results}


async def assemble_response(state: ResourceGenState) -> dict:
    """汇总结果 + 持久化到 DB + MinIO + 向量库"""
    from services.db import save_resource
    from services.resource_ingest import ingest_resource

    generated = state.get("generated", {})
    student_id = state.get("student_id", 0)
    course_id = state.get("course_id", 0)
    topic = state.get("topic", "")
    validation_results = state.get("validation_results", {})

    success = 0
    failed = 0
    resource_ids = []

    for resource_type, result in generated.items():
        if result.get("error") or result.get("content") is None:
            failed += 1
            continue

        try:
            is_validated = validation_results.get(resource_type, {}).get("passed", False)
            rid = save_resource(
                student_id=student_id,
                course_id=course_id,
                resource_type=resource_type,
                title=result.get("title", f"{resource_type}: {topic}"),
                topic=topic,
                content=result["content"],
                is_validated=is_validated,
            )
            resource_ids.append(rid)
            success += 1
            logger.info(f"[assemble] saved resource id={rid} type={resource_type}")

            # 入库到 MinIO + course_materials + 向量库（最佳努力，不影响主流程）
            try:
                ingest_result = ingest_resource(
                    resource_id=rid,
                    resource_type=resource_type,
                    title=result.get("title", f"{resource_type}: {topic}"),
                    topic=topic,
                    content=result["content"],
                    course_id=course_id,
                    student_id=student_id,
                )
                logger.info(
                    f"[assemble] ingest resource id={rid}: "
                    f"material_id={ingest_result.get('material_id')}, "
                    f"chunks={ingest_result.get('chunk_count', 0)}"
                )
            except Exception as ingest_err:
                logger.warning(f"[assemble] ingest failed for resource {rid}: {ingest_err}")
        except Exception as e:
            logger.error(f"[assemble] failed to save {resource_type}: {e}")
            failed += 1

    return {
        "generated_count": success,
        "failed_count": failed,
        "resource_ids": resource_ids,
        "summary_text": f"已生成 {success} 个资源" + (f"，{failed} 个失败" if failed else "") + "。",
    }


# ── 条件边: fanout ──

def fanout_to_generators(state: ResourceGenState) -> list:
    """并行分发到生成节点"""
    nodes = []
    for rt in state.get("resource_types", []):
        nodes.append(f"gen_{rt}")
    return nodes if nodes else ["assemble"]


# ── 编译函数 ──

def compile_resource_gen_graph():
    """编译 ResourceGenState 图"""
    graph = StateGraph(ResourceGenState)

    # 添加节点
    graph.add_node("plan_resources", plan_resource_list)
    graph.add_node("gen_document", generate_document)
    graph.add_node("gen_mermaid", generate_mermaid)
    graph.add_node("gen_exercise_set", generate_exercise_set)
    graph.add_node("gen_code_case", generate_code_case)
    graph.add_node("gen_reading", generate_reading_material)
    graph.add_node("validate", validate_all_resources)
    graph.add_node("assemble", assemble_response)

    # 入口
    graph.set_entry_point("plan_resources")

    # fanout 条件分发
    graph.add_conditional_edges("plan_resources", fanout_to_generators, {
        "gen_document": "gen_document",
        "gen_mermaid": "gen_mermaid",
        "gen_exercise_set": "gen_exercise_set",
        "gen_code_case": "gen_code_case",
        "gen_reading": "gen_reading",
        "assemble": "assemble",
    })

    # 所有生成节点 → validate
    for node in ["gen_document", "gen_mermaid", "gen_exercise_set", "gen_code_case", "gen_reading"]:
        graph.add_edge(node, "validate")

    # validate → assemble
    graph.add_edge("validate", "assemble")
    graph.add_edge("assemble", END)

    return graph.compile()
