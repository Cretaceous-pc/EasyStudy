export interface Message {
  message_id: number;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    source_chunks?: SourceChunk[];
    generated_resources?: GeneratedResource[];
  };
  created_at: string;
}

export interface SourceChunk {
  material_id: number;
  chapter: string;
  section?: string;
  title?: string;
}

export interface GeneratedResource {
  resource_id: number;
  type: string;
}

export interface Conversation {
  conversation_id: number;
  course_id: number;
  material_id?: number | null;
  context_type?: string;
  title: string;
  last_message?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface CoursewareSession {
  exists: boolean;
  conversation: Conversation | null;
}

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface ChatContext {
  currentCourse?: string;
  currentChapter?: string;
  fileType?: string;
  resourceId?: number;
}
