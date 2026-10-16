"""
资源生成 Prompt 模板

对应 LangGraph 节点:
  - PROMPT_GENERATE_DOCUMENT      → ResourceGenState.gen_document
  - PROMPT_GENERATE_MERMAID       → ResourceGenState.gen_mermaid
  - PROMPT_GENERATE_EXERCISE_SET  → ResourceGenState.gen_exercise_set
  - PROMPT_GENERATE_CODE_CASE     → ResourceGenState.gen_code_case
  - PROMPT_GENERATE_READING       → ResourceGenState.gen_reading

变量命名规则:
  - 使用下划线扁平变量 (profile_knowledge_base)，非点分 (profile.knowledge_base.label)
  - str.format() 不支持点分变量名

参考设计: docs/easyStudy-Prompt模板设计.md §三
"""

# ── 1. 课程讲解文档 ──
PROMPT_GENERATE_DOCUMENT = """\
你是一位大学课程助教。请基于以下课程资料，为学生生成一份个性化的课程讲解文档。

## 学生画像
- 知识基础: {profile_knowledge_base}
- 学习目标: {profile_learning_goal}
- 认知风格: {profile_cognitive_style}
- 学习节奏: {profile_learning_pace}
- 易错点: {profile_error_prone_points}

## 课程资料（仅供你参考，回答必须基于这些资料）
{rag_context}

## 用户生成要求
{requirements}

## 学习主题
{topic}

## 输出要求
1. 使用 Markdown 格式，包含完整的标题层级（# ## ### ####）
2. 结构：概述 → 核心概念 → 详细讲解 → 代码示例（如适用） → 常见误区 → 小结
3. 在知识点之间插入思考题（> 💡 思考：...）
4. 在末尾标注资料来源（如适用）
5. 如果学生有易错点与该主题相关，在对应位置加上：
   > ⚠️ 注意：这是你的易错知识点，请特别留意以下内容...
6. 只基于课程资料编写，不要引入外部知识
"""

# ── 2. 知识点思维导图 (Mermaid) ──
PROMPT_GENERATE_MERMAID = """\
你是一位知识可视化专家。请为以下知识点生成 Mermaid 格式的思维导图。

## 学习主题
{topic}

## 课程资料
{rag_context}

## 用户生成要求
{requirements}

## 学生画像
- 认知风格: {profile_cognitive_style}
- 知识基础: {profile_knowledge_base}
- 学习节奏: {profile_learning_pace}

## 输出要求
1. 输出纯 Mermaid 代码（graph TD 格式），放在 ```mermaid 代码块中
2. 节点文字简洁（每个节点 ≤15 个字），使用中文
3. 深度控制在 2-3 层
4. 使用不同形状区分概念类型：
   - 核心概念用圆角矩形 ([])
   - 算法/方法用矩形 []
   - 注意事项用菱形 {{}}
   - 代码/实操用平行四边形 [//]
5. 在代码块后附一段 50 字以内的图表说明
6. 如果学生是视觉型，增加颜色标注提示（::: 语法）

输出格式：
```mermaid
graph TD
  A[核心概念] --> B[子概念1]
  ...
```

**图表说明**：本图展示了...
"""

# ── 3. 练习题集 ──
PROMPT_GENERATE_EXERCISE_SET = """\
你是一位大学课程命题专家。请基于课程资料为学生生成练习题。

## 学习主题
{topic}

## 课程资料
{rag_context}

## 用户生成要求
{requirements}

## 学生画像
- 知识基础: {profile_knowledge_base}
- 易错点: {profile_error_prone_points}
- 学习目标: {profile_learning_goal}

## 题目要求
- 共生成 5 道题，包含：
  - 2 道单选题（考察概念理解）
  - 1 道多选题（考察辨析能力）
  - 1 道填空题（考察关键术语）
  - 1 道编程/实操题（考察应用能力）
- 难度分布：基础 40% + 中等 40% + 进阶 20%
- 针对学生的易错点，至少 2 道题覆盖相关知识点
- 每道题附带详细的解析（为什么对、为什么错）
- 编程题需要包含：
  - 题目描述
  - 输入输出示例
  - 测试用例（至少2个）
  - 参考答案代码

## 输出 JSON 格式
{{
  "exercises": [
    {{
      "type": "single_choice|multi_choice|fill_blank|coding",
      "question": "题目文字（Markdown 格式）",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": 0,
      "explanation": "详细解析",
      "difficulty": "basic|medium|advanced",
      "related_topic": "关联的知识点",
      "test_cases": [{{"input": "...", "expected": "..."}}]
    }}
  ]
}}

## 规则
- 只输出 JSON，不要任何解释
- options 仅选择题需要，编程题可以为空数组
- test_cases 仅编程题需要
"""

# ── 4. 代码实操案例 ──
PROMPT_GENERATE_CODE_CASE = """\
你是一位编程实践导师。请基于课程资料生成一个完整的代码实操案例。

## 学习主题
{topic}

## 课程资料
{rag_context}

## 用户生成要求
{requirements}

## 学生画像
- 知识基础: {profile_knowledge_base}
- 学习节奏: {profile_learning_pace}

## 输出要求
使用 Markdown 格式，包含以下结构：

# {{案例标题}}

## 学习目标
- 列出 2-3 个具体的学习目标

## 环境要求
- 语言/框架版本
- 依赖库（如有）

## 背景知识
简要说明本案例涉及的核心概念（2-3句）

## 完整代码
```python
# 包含详细注释的完整代码
# 每个关键步骤要有注释说明
```

## 代码详解
逐步解释关键代码段（每段 3-5 行说明）

## 运行结果
展示预期输出（如果是命令行程序）

## 常见错误
列出 1-2 个初学者容易犯的错误及解决方法

## 扩展练习
1-2 个变体练习（让学生自己修改代码）

## 规则
- 代码必须完整可运行（不要用 ... 省略）
- 注释用中文，变量名用英文
- 如果学生是初学者，代码中的概念解释要更详细
"""

# ── 5. 拓展阅读材料 ──
PROMPT_GENERATE_READING = """\
你是一位学术阅读指导。请基于课程资料和相关文献，为学生推荐拓展阅读材料。

## 学习主题
{topic}

## 课程资料
{rag_context}

## 用户生成要求
{requirements}

## 学生画像
- 学习目标: {profile_learning_goal}
- 知识基础: {profile_knowledge_base}
- 学习节奏: {profile_learning_pace}

## 输出要求
生成 3 篇拓展阅读推荐，每篇包含：

1. **标题**：文献/文章标题
2. **来源摘要**：100-150 字的核心内容概述
3. **推荐理由**：为什么适合这个学生（结合画像说明）
4. **阅读难度**：入门/中等/进阶
5. **预计阅读时间**：分钟数
6. **关键收获**：读完能获得什么（2-3 点）

## 输出 JSON 格式
{{
  "articles": [
    {{
      "title": "...",
      "summary": "...",
      "relevance": "结合学生画像的个性化推荐理由",
      "difficulty": "basic|medium|advanced",
      "estimated_read_minutes": 15,
      "key_takeaways": ["收获1", "收获2"]
    }}
  ]
}}

## 规则
- 推荐的阅读材料必须与课程资料有明确关联
- 优先推荐课程资料中引用的原始文献
- 难度应与学生当前水平匹配（可略高一个级别作为挑战）
- 只输出 JSON，不要任何解释
"""
