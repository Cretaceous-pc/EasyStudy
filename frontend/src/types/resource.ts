// ── 资源生成相关类型 ───────────────────────────

export type ResourceType =
  | 'document'
  | 'mermaid'
  | 'exercise_set'
  | 'code_case'
  | 'reading_material';

export interface Resource {
  id: string;
  resource_type: ResourceType;
  title: string;
  topic: string;
  is_validated: boolean;
  created_at: string;
  content: unknown;       // varies by resource_type: string | {markdown, ...} | {title, url, ...}[]
  source_chunks: unknown[];
  status: string;
}

export interface GenerationProgress {
  current: number;
  total: number;
  status: string;
  message: string;
}
