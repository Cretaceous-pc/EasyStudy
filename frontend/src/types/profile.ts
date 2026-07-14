// ── 学习画像相关类型 ───────────────────────────

export interface ProfileDimension {
  key: string;
  label: string;
  value: number; // 0-100（已归一化，供雷达图/进度条使用）
  description?: string;
  /** 原始值（字符串，如 "low"/"visual"/"exam_prep"） */
  rawValue?: string | number;
}

/** 前端标准画像结构 */
export interface StudentProfile {
  student_id: number;
  course_id: number;
  dimensions: ProfileDimension[];
  version: number;
  updated_at: string;
  /** 由前端根据 dimension labels 生成的摘要文本 */
  summary: string;
}

/** 画像快照 */
export interface ProfileSnapshot {
  id: string;
  summary: string;
  createdAt: string;
  trigger: string;
}

// ── 维度分数归一化（API 返回的原始值 → 0–100 数值）──

/** 维度 key → 中文名称 */
export const DIMENSION_NAMES: Record<string, string> = {
  knowledge_base: '知识基础',
  learning_goal: '学习目标',
  cognitive_style: '认知风格',
  error_prone_points: '易错点',
  learning_pace: '学习节奏',
  engagement: '参与度',
};

const KNOWLEDGE_BASE_SCORES: Record<string, number> = {
  low: 25, medium: 50, high: 80, very_high: 95,
};

const LEARNING_PACE_SCORES: Record<string, number> = {
  fast: 80, medium: 50, slow: 20,
};

/**
 * 将 API 返回的原始维度值映射为 0–100 归一化分数。
 *
 * 映射规则：
 * - knowledge_base: low→25, medium→50, high→80, very_high→95
 * - learning_goal: 不量化，统一 50（中性）
 * - cognitive_style: 不量化，统一 50（中性）
 * - error_prone_points: 非空列表→40，空→80（少=好）
 * - learning_pace: fast→80, medium→50, slow→20
 * - engagement: 0.0–1.0 乘以 100；其他数值直接使用
 */
export function normalizeScore(key: string, rawValue: unknown): number {
  switch (key) {
    case 'knowledge_base': {
      const s = String(rawValue);
      return KNOWLEDGE_BASE_SCORES[s] ?? 50;
    }
    case 'learning_goal':
      // 学习目标不可量化，固定中性
      return 50;
    case 'cognitive_style':
      // 认知风格不可量化，固定中性
      return 50;
    case 'error_prone_points': {
      if (Array.isArray(rawValue)) {
        return rawValue.length === 0 ? 80 : Math.max(20, 80 - rawValue.length * 10);
      }
      return 50;
    }
    case 'learning_pace': {
      const s = String(rawValue);
      return LEARNING_PACE_SCORES[s] ?? 50;
    }
    case 'engagement': {
      const n = Number(rawValue);
      if (!Number.isNaN(n)) {
        // 0-1 范围的按百分比处理，>1 的直接用
        return n <= 1 ? Math.round(n * 100) : Math.min(100, Math.round(n));
      }
      return 50;
    }
    default:
      // 未知维度：尝试转数字
      const n = Number(rawValue);
      return Number.isNaN(n) ? 50 : Math.min(100, Math.max(0, Math.round(n)));
  }
}

/** 从 dimension labels 生成摘要 */
export function buildSummary(dimensions: ProfileDimension[]): string {
  if (!dimensions.length) return '';
  const kv = dimensions.map((d) => {
    const display = d.rawValue ?? d.value;
    return `${d.label}：${display}`;
  }).join('，');
  return `当前画像：${kv}`;
}
