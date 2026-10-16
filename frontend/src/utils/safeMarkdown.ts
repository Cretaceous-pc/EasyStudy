import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Options as SanitizeOptions } from 'rehype-sanitize';
import type { Root, Element } from 'hast';
import type { PluggableList } from 'unified';

/**
 * 宽松但仍安全的 CSS 属性白名单。
 *
 * KaTeX 通过内联 style 定位公式（top / left / width / height / margin /
 * padding / font-* / vertical-align 等）。若整体禁用 style，所有数学公式
 * 都会渲染失败。但 style 本身也是注入面，因此这里只放行"排版类"属性，
 * 明确排除 background-image / background / cursor / content 等
 * 可用于数据外带或交互欺骗的属性。
 */
const SAFE_CSS_PROPS = new Set([
  'height', 'min-height', 'max-height',
  'width', 'min-width', 'max-width',
  'top', 'bottom', 'left', 'right', 'inset',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-width', 'border-style', 'border-color',
  'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-radius',
  'font', 'font-size', 'font-weight', 'font-style', 'font-family',
  'line-height', 'letter-spacing', 'word-spacing',
  'text-align', 'text-indent', 'text-decoration', 'text-transform',
  'vertical-align', 'white-space', 'word-break', 'word-wrap', 'overflow-wrap',
  'display', 'position', 'overflow', 'overflow-x', 'overflow-y',
  'color', 'opacity', 'visibility', 'float', 'clear', 'direction',
  'list-style', 'list-style-type', 'box-sizing', 'flex', 'flex-direction',
  'align-items', 'justify-content', 'gap', 'transform',
]);

/** 单个 style 声明是否安全：属性名在白名单内，且值不含 url()/expression/反斜杠转义 */
function isSafeStyleDeclaration(decl: string): boolean {
  const trimmed = decl.trim();
  if (!trimmed) return false;
  const colon = trimmed.indexOf(':');
  if (colon <= 0) return false;

  const prop = trimmed
    .slice(0, colon)
    .trim()
    .toLowerCase()
    .replace(/^-(webkit|moz|ms|o)-/, '');
  if (!SAFE_CSS_PROPS.has(prop)) return false;

  const value = trimmed.slice(colon + 1).toLowerCase();
  // 这三种写法可用于发起请求或执行代码，即使属性名合法也必须拒绝
  if (value.includes('url(') || value.includes('expression') || value.includes('\\')) return false;
  return true;
}

/** 过滤 style 属性值，返回 null 表示整条 style 应被移除 */
function sanitizeStyleValue(value: string): string | null {
  const kept = value
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d.length > 0 && isSafeStyleDeclaration(d));
  return kept.length > 0 ? kept.join('; ') : null;
}

/**
 * 基于默认白名单扩展：
 *  - 保留 KaTeX：允许 style 属性（值经 SAFE_CSS_PROPS 过滤）+ KaTeX/MathML 标签
 *  - 保留代码高亮：允许 code/pre/span 的 className（language-* / hljs-*）
 *  - 保留 Mermaid：允许 class="mermaid"
 *  - 不放行：iframe / script / style 标签 / meta / base / object / embed /
 *    form，以及所有 on* 事件属性（默认 schema 本就排除，此处重申）
 */
// 从 Schema 自身派生属性定义类型，避免依赖包未在入口导出的类型名
type AttrDefs = NonNullable<SanitizeOptions['attributes']>;
const baseAttributes = (defaultSchema.attributes ?? {}) as AttrDefs;

export const sanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...baseAttributes,
    '*': [
      ...(baseAttributes['*'] ?? []),
      'className',
      'style',
      'ariaHidden',
      'ariaLabel',
      'id',
      'role',
    ],
    span: [
      ['className', /^(katex|mord|mbin|mrel|mopen|mclose|mpunct|minner|mop|mspace|base|strut|vlist|hljs|hljs-.*|math-.*|mermaid).*$/],
      'style',
      'ariaHidden',
    ],
    code: [['className', /^(language-.*|hljs.*|math-.*)$/], 'style'],
    pre: [['className', /^(hljs.*|language-.*)$/], 'style'],
    div: [['className', /^(mermaid|katex-display|math-display|hljs.*)$/], 'style'],
    math: [['className', /^math-.*$/]],
    annotation: ['encoding'],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // KaTeX 的 MathML 输出
    'math', 'semantics', 'annotation', 'mtext', 'mi', 'mo', 'mn', 'mrow',
    'msup', 'msub', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'mover', 'munder',
    'munderover', 'mtable', 'mtr', 'mtd', 'mspace', 'mpadded', 'mphantom',
    'menclose', 'mmultiscripts', 'mprescripts', 'none',
  ],
  // 显式声明 href/src 的协议白名单（默认 schema 已含，此处重申以防上游变更）
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
};

/** 元素级拦截 style：先按 CSS 属性白名单过滤，再交给默认清洗 */
function rehypeFilterStyle() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      const anyNode = node as unknown as {
        properties?: Record<string, unknown>;
        children?: unknown[];
      };
      if (anyNode.properties && typeof anyNode.properties === 'object') {
        const props = anyNode.properties;
        if (typeof props.style === 'string') {
          const cleaned = sanitizeStyleValue(props.style);
          if (cleaned === null) delete props.style;
          else props.style = cleaned;
        }
      }
      if (Array.isArray(anyNode.children)) {
        for (const child of anyNode.children) {
          const c = child as { type?: string };
          if (c && typeof c === 'object' && c.type === 'element') {
            visit(child as Element);
          }
        }
      }
    };
    visit(tree);
  };
}

/**
 * 统一的 rehype 插件链 —— 所有 markdown 渲染点都必须使用它。
 *
 * 顺序很关键: rehypeRaw（解析原始 HTML）必须在最前，随后立刻 sanitize。
 * 若顺序颠倒或漏掉 sanitize，AI 输出 / 课件正文 / RAG 检索到的资料中的
 * HTML 会被原样注入 DOM —— 已实测 <iframe srcdoc="<script>…">、
 * <style>、<meta http-equiv=refresh> 三种向量可执行，而 JWT 存在
 * localStorage，等于可直接窃取账号。
 *
 * 用法（保持与本文件相同的相对顺序）:
 *   rehypePlugins={[...safeRehypePlugins, rehypeKatex, rehypeHighlight]}
 */
export const safeRehypePlugins: PluggableList = [
  rehypeFilterStyle,
  [rehypeSanitize, sanitizeSchema],
];

export default safeRehypePlugins;
