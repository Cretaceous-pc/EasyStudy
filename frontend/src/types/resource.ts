// ── 资源生成相关类型 ───────────────────────────

export type ResourceType =
  | 'document'
  | 'mermaid'
  | 'exercise_set'
  | 'code_case'
  | 'reading_material';

/**
 * 资源条目。
 *
 * 字段与后端 backend-ai 的返回严格对齐（db.get_available_resources /
 * get_resource_by_id / routers/resources.py 的 SSE resource 事件）：
 *   - 主键字段名是 resource_id（数字），不是 id
 *   - course_id 仅在详情接口返回；列表接口不返回
 *   - is_validated / source_chunks / status 仅在详情接口返回
 * 原类型声明 { id: string; topic: string; is_validated: boolean; ... } 与
 * 真实响应不符，导致 ResourceCard 里 parseInt(resource.id, 10) 之类的
 * 代码在类型层面看似合理、运行时却拿到 NaN。
 */
export interface Resource {
  resource_id: number;
  resource_type: ResourceType;
  title: string;
  topic: string;
  /** 结构随 resource_type 变化：string | {markdown,...} | {title,url,...}[] */
  content: unknown;
  created_at: string;
  course_id?: number;
  is_validated?: boolean;
  source_chunks?: unknown[];
  status?: string;
}

export interface GenerationProgress {
  current: number;
  total: number;
  status: string;
  message: string;
}
