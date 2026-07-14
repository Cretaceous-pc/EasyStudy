declare module 'react-markdown' {
  import type { ReactNode } from 'react';
  interface ReactMarkdownProps {
    children: string;
    remarkPlugins?: unknown[];
    rehypePlugins?: unknown[];
    components?: Record<string, (props: any) => ReactNode>;
  }
  export default function ReactMarkdown(props: ReactMarkdownProps): JSX.Element;
}

declare module 'remark-math' {
  const plugin: unknown;
  export default plugin;
}

declare module 'remark-gfm' {
  const plugin: unknown;
  export default plugin;
}

declare module 'rehype-katex' {
  const plugin: unknown;
  export default plugin;
}

declare module 'rehype-highlight' {
  const plugin: unknown;
  export default plugin;
}
