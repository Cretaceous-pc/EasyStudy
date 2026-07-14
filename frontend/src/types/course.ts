export interface Course {
  course_id: number;
  title: string;
  description?: string;
  subject: string;
  cover_url?: string;
  teacher_name: string;
  status: 'draft' | 'published' | 'archived';
  student_count: number;
  created_at: string;
}

export interface CourseDetail extends Course {
  teacher: {
    user_id: number;
    display_name: string;
  };
  materials_count: number;
  chapters: string[];
  updated_at: string;
}

export interface CourseEnrollment {
  course_id: number;
  title: string;
  progress_percent: number;
  enrolled_at: string;
}
