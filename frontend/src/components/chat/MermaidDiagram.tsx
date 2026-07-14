import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// 初始化 mermaid（全局配置）
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  themeVariables: {
    fontFamily: 'var(--font-sans), system-ui, sans-serif',
    fontSize: '13px',
    primaryColor: '#faf6f0',
    primaryBorderColor: '#e8e2d6',
    primaryTextColor: '#3d3633',
    lineColor: '#b5a898',
    secondaryColor: '#f5f0e8',
    tertiaryColor: '#faf8f5',
  },
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
  sequence: { useMaxWidth: true },
  gantt: { useMaxWidth: true },
});

interface MermaidDiagramProps {
  chart: string;
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    if (!containerRef.current || !chart.trim()) return;
    let cancelled = false;

    const render = async () => {
      try {
        const { svg } = await mermaid.render(idRef.current, chart.trim());
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message || '图表渲染失败');
        }
      }
    };

    render();
    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    return (
      <div style={{
        border: '1px solid var(--border-cream)',
        borderRadius: 8,
        padding: '12px 16px',
        margin: '10px 0',
        background: 'var(--parchment)',
        fontSize: 12,
        color: 'var(--stone-gray)',
        fontFamily: 'var(--font-sans)',
      }}>
        <div style={{ marginBottom: 8, color: '#b55738', fontWeight: 500 }}>
          ⚠ 图表渲染失败
        </div>
        <pre style={{
          fontSize: 11,
          color: 'var(--olive-gray)',
          whiteSpace: 'pre-wrap',
          margin: 0,
        }}>
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container"
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 0',
        margin: '10px 0',
        background: 'var(--ivory)',
        border: '1px solid var(--border-cream)',
        borderRadius: 8,
        overflowX: 'auto',
      }}
    />
  );
}
