"""
学习路径相关 Prompt 模板

对应 LangGraph 节点:
  - PROMPT_PATH_GENERATE → PathGenState.generate_path
"""

# ── 学习路径规划 ──
PROMPT_PATH_GENERATE = """\
你是一位课程教学设计专家。请根据学生的偏好问卷为其规划个性化的学习路径。路径生成完全基于问卷答案，不依赖外部课程数据。

## 学生画像（仅作辅助参考，非决定性因素）
- 知识基础: {profile_knowledge_base}
- 学习目标: {profile_learning_goal}
- 学习节奏: {profile_learning_pace}

## 用户偏好问卷（核心依据，完全围绕此生成路径）
- 学习目的: {q_purpose}
- 每天学习时间: {q_daily_study_time}
- 期望深度: {q_depth}
- 当前水平: {q_level}
- 想学习的具体内容（用户自述，最重要！）: {q_topic}

## 路径规划规则
1. **最重要**：仔细理解"想学习的具体内容"中用户的自述，这是最核心的需求信号。用户提到的知识点、工具、场景必须出现在路径中
2. **树状结构（关键）**：路径必须是分支树，不是直线链条。做法：
   - 先放置 1-2 个公共基础节点（dependencies=[]）
   - 然后拆分为 2-3 条并行分支，每条分支覆盖不同子主题
   - 最后用 1 个综合 review 节点收束，该节点的 dependencies 包含所有分支的末端节点
   - 每条分支内部 2-3 个节点
3. 根据"当前水平"跳过已掌握内容，根据"期望深度"决定展开程度
4. 根据"每天学习时间"调整 estimated_minutes：
   - 少于30分钟：每个节点 10-20 分钟
   - 30分钟-1小时：每个节点 20-40 分钟
   - 1-2小时：每个节点 30-50 分钟
   - 2小时以上：每个节点 40-60 分钟

## 输出 JSON
{{
  "items": [
    {{
      "seq_order": 1,
      "item_type": "chapter|resource|exercise|review",
      "item_ref_id": null,
      "title": "节点标题（中文，15字以内）",
      "summary": "一句话概述（树上显示，20字以内）",
      "description": "详细说明这个节点要做什么",
      "estimated_minutes": 30,
      "reason": "为什么安排这个节点（结合问卷的一句话理由）",
      "dependencies": [],
      "detail": {{
        "description": "节点的详细描述（100-200字）",
        "learning_points": ["学习要点1", "学习要点2", "学习要点3"],
        "resources": [
          {{"title": "推荐资源名", "type": "video|article|exercise|book"}}
        ],
        "difficulty": "beginner|intermediate|advanced"
      }}
    }}
  ]
}}

## 依赖规则（必须严格遵守，形成树状拓扑）
- dependencies 为该节点的前置节点 seq_order 列表
- 第一个节点 dependencies 为空数组 []
- 分支节点的 dependencies 指向其前置公共节点；收束节点的 dependencies 包含多条分支末端的 seq_order
- 禁止每个节点只依赖前一个节点（即禁止 dependencies: [n-1] 的线性链条）

## 树状结构示例（12节点：1个根→3条分支各2-3节点→1个收束）
- seq_order=1: dependencies=[], title="公共基础"              ← 根
- seq_order=2: dependencies=[1], title="分支A-基础"            ← 分支A
- seq_order=3: dependencies=[1], title="分支B-基础"            ← 分支B
- seq_order=4: dependencies=[1], title="分支C-基础"            ← 分支C
- seq_order=5: dependencies=[2], title="分支A-进阶"            ← 分支A延续
- seq_order=6: dependencies=[3], title="分支B-进阶"            ← 分支B延续
- seq_order=7: dependencies=[4], title="分支C-进阶"            ← 分支C延续
- seq_order=8: dependencies=[5], title="分支A-实战"            ← 分支A收尾
- seq_order=9: dependencies=[6,7], title="B+C交叉应用"         ← 分支交汇
- seq_order=10: dependencies=[8], title="总复习-上"            ← 综合复习
- seq_order=11: dependencies=[9], title="总复习-下"            ← 综合复习
- seq_order=12: dependencies=[10,11], title="综合测验"         ← 收束

## 规则
- 至少生成 12 个节点
- 至少包含 3 条并行分支，每条分支 2-3 个节点
- 严格按 JSON 格式输出，不要任何解释
- item_type 只能使用: chapter, resource, exercise, review
"""


# ── 节点教学内容生成 ──
PROMPT_NODE_TEACH = """\
你是课程教学助手。为以下学习节点撰写结构化的教学内容。

节点标题: {title}
节点类型: {item_type}
难度: {difficulty}
描述: {description}
学习要点: {learning_points}
路径上下文: {path_context}

写作要求:
- 使用 Markdown 格式输出
- beginner: 用生活类比引入（### 引入），语言通俗易懂，多举实际例子
- intermediate: 讲清核心概念和工作原理（### 核心概念），配 1-2 个应用实例（### 应用实例）
- advanced: 深入分析底层机制（### 原理分析），展示推导思路，有一定挑战性
- 正文 500-2000 字，中文
- 使用 ## 和 ### 标题分层，段落之间用空行分隔
- 涉及代码时用 ``` 代码块包裹并标注语言
- 重点内容用 **粗体** 强调
- 不要在开头重复节点标题（标题已在弹窗顶部展示）
"""
