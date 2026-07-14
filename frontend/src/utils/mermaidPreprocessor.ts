/**
 * Mermaid 图预处理工具
 *
 * 问题：AI 生成 Mermaid 图表时直接输出语法（如 `graph TD`、`quadrantChart`），
 * 不包裹在 ```mermaid 代码块中，导致 ReactMarkdown 无法识别为代码块，从而 MermaidDiagram 组件不被调用。
 *
 * 解决方案：按段落（\n\n 分隔）扫描文本，将首行匹配 Mermaid 图类型的段落包裹到 ```mermaid 代码块中。
 */

// Mermaid 图表声明的特征行（必须匹配段落首行的精确值）
const MERMAID_DIAGRAM_TYPES = [
  'graph\\s+(TD|LR|RL|BT)',
  'flowchart\\s+(TD|LR|RL|BT|TB)',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram(?:-v2)?',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'quadrantChart',
  'requirementDiagram',
  'gitGraph',
  'mindmap',
  'timeline',
  'sankey-beta',
  'xychart-beta',
  'block-beta',
  'packet-beta',
  'kanban',
  'architecture-beta',
];

const MERMAID_FIRST_LINE = new RegExp(
  '^(' + MERMAID_DIAGRAM_TYPES.join('|') + ')$',
  'i'
);

/**
 * 预处理 Markdown 文本，将内嵌的 Mermaid 图表段落包裹在 ```mermaid 代码块中
 */
export function preprocessMermaid(content: string): string {
  if (!content) return content;

  // 如果内容已经包含 ```mermaid 代码块，跳过（已被包裹过）
  if (/```mermaid/.test(content)) return content;

  // 按双换行分割为段落
  const paragraphs = content.split(/\n{2,}/);

  const processed = paragraphs.map((para) => {
    const trimmed = para.trim();
    if (!trimmed) return para;

    // 获取段落第一行文本
    const firstLine = trimmed.split('\n')[0].trim();

    // 检查第一行是否为 Mermaid 图表声明
    if (MERMAID_FIRST_LINE.test(firstLine)) {
      return '```mermaid\n' + trimmed + '\n```';
    }

    return para;
  });

  return processed.join('\n\n');
}
