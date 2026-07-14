export interface FileObject {
  id: number;
  title: string;
  chapter: string;
  section: string;
  fileType: 'md' | 'pdf' | 'resource';
  fileUrl: string;
  courseId: number;
  courseTitle: string;
  /** 资源预加载内容（fileType='resource' 时使用，避免额外 API 请求） */
  resourceContent?: string;
}

export interface Material {
  material_id: number;
  title: string;
  material_type: string;
  chapter: string;
  section?: string;
  file_url: string;
  processing_status: string;
  chunk_count?: number;
  created_at: string;
}

export interface MaterialContent {
  material_id: number;
  title: string;
  content: string;
  file_url: string;
}
