"""
校验智能体 Prompt 模板

对应 LangGraph 节点:
  - PROMPT_VALIDATE_RESOURCE  → ResourceGenState.validate (资源内容校验)
  - PROMPT_VALIDATE_EXERCISE  → ResourceGenState.validate (练习题答案校验)

变量命名规则:
  - 使用下划线扁平变量
  - str.format() 不支持点分变量名

参考设计: docs/easyStudy-Prompt模板设计.md §五
"""

# ── 1. 资源内容校验 ──
PROMPT_VALIDATE_RESOURCE = """\
你是一位严格的课程内容审核员。请校验以下 AI 生成的学习资源。

## 资源类型
{resource_type}

## 资源内容
{resource_content}

## 课程参考资料（权威来源）
{rag_context}

## 校验维度
1. **事实准确性**：内容中的事实断言是否与参考资料一致？有无编造或错误？
2. **完整性**：是否覆盖了主题的核心知识点？
3. **安全性**：是否包含违规、有害、歧视性内容？
4. **代码可运行性**（仅代码类资源）：代码逻辑是否正确？
5. **引用正确性**：引用的章节号、资料名是否与参考资料匹配？

## 输出 JSON
{{
  "passed": true|false,
  "checks": {{
    "factual_accuracy": {{"passed": true|false, "issues": ["具体问题描述"]}},
    "completeness": {{"passed": true|false, "issues": []}},
    "safety": {{"passed": true|false, "issues": []}},
    "code_correctness": {{"passed": true|false, "issues": []}},
    "citation_accuracy": {{"passed": true|false, "issues": []}}
  }},
  "summary": "一句话总结校验结果",
  "suggestion": "如果不通过，建议如何修改"
}}

## 规则
- 只输出 JSON，不要任何解释
- issues 数组为空时表示该维度通过
- 对于非代码类资源，code_correctness 的 passed 设为 true
"""

# ── 2. 练习题答案校验 ──
PROMPT_VALIDATE_EXERCISE = """\
校验以下练习题的答案是否正确。

## 题目与答案
{exercise_json}

## 课程参考资料
{rag_context}

## 校验要点
- 单选题/多选题：正确答案是否唯一且与资料一致？
- 填空题：答案是否精准？
- 编程题：参考答案代码能否通过所有测试用例？
- 解析是否正确且完整？

## 输出 JSON
{{
  "passed": true|false,
  "per_exercise": [
    {{"index": 0, "passed": true, "issue": null}},
    {{"index": 1, "passed": false, "issue": "选项B也正确，因为..."}}
  ]
}}

## 规则
- 只输出 JSON，不要任何解释
- 如果全部通过，passed 为 true
- 每道题的状态独立，某道题不通过不影响其他题
"""
