import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ProfileDimension } from '../../types/profile';

interface ProfileRadarProps {
  dimensions: ProfileDimension[];
}

export default function ProfileRadar({ dimensions }: ProfileRadarProps) {
  const option = useMemo(() => {
    if (!dimensions.length) return null;

    const indicator = dimensions.map((d) => ({ name: d.label, max: 100 }));
    const dataValues = dimensions.map((d) => d.value);

    return {
      color: ['#c96442'],
      radar: {
        indicator,
        shape: 'polygon' as const,
        radius: '65%',
        center: ['50%', '50%'],
        axisName: {
          color: '#5e5d59',
          fontSize: 12,
          fontFamily: 'var(--font-sans)',
        },
        splitArea: {
          areaStyle: { color: ['#faf9f5', '#f5f4ed', '#faf9f5', '#f5f4ed'] },
        },
        axisLine: { lineStyle: { color: '#e8e6dc' } },
        splitLine: { lineStyle: { color: '#e8e6dc' } },
      },
      series: [
        {
          type: 'radar' as const,
          data: [
            {
              value: dataValues,
              name: '当前画像',
              symbol: 'circle' as const,
              symbolSize: 6,
              lineStyle: { width: 2, color: '#c96442' },
              areaStyle: { color: 'rgba(201,100,66,0.12)' },
              itemStyle: { color: '#c96442', borderColor: '#fff', borderWidth: 2 },
            },
          ],
        },
      ],
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#faf9f5',
        borderColor: '#f0eee6',
        textStyle: { color: '#141413', fontSize: 12 },
        formatter: (params: any) => {
          const vals: number[] = params.value;
          let html = `<div style="font-weight:500;margin-bottom:4px">${params.name}</div>`;
          vals.forEach((v: number, i: number) => {
            const dim = dimensions[i];
            const display = dim?.rawValue ?? v;
            html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
              <span style="width:6px;height:6px;border-radius:50%;background:#c96442"></span>
              <span style="flex:1">${dim?.label ?? '?'}</span>
              <span style="font-weight:500">${display}</span>
            </div>`;
          });
          return html;
        },
      },
    };
  }, [dimensions]);

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--ivory)',
        border: '1px solid var(--border-cream)',
        boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
      }}
    >
      <SectionLabel>6 维雷达图</SectionLabel>
      {option ? (
        <ReactECharts option={option} style={{ height: 320 }} opts={{ renderer: 'svg' }} />
      ) : (
        <div
          className="flex items-center justify-center"
          style={{ height: 320, color: 'var(--stone-gray)', fontSize: 13 }}
        >
          暂无数据，请先填写问卷
        </div>
      )}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 500,
        color: 'var(--stone-gray)',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
