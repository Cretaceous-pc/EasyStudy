import { useTeacherStore } from '../stores/teacherStore';
import { useAuthStore } from '../stores/authStore';

export function seedTeacherMock() {
  const authStore = useAuthStore.getState();
  const user = authStore.userInfo;

  // 只有教师/管理员角色才注入教师端数据
  if (!user || (!user.roles.includes('ROLE_TEACHER') && !user.roles.includes('ROLE_ADMIN'))) {
    return;
  }

  const teacherStore = useTeacherStore.getState();

  teacherStore.setMyCourses([
    {
      course_id: 1,
      title: '机器学习基础',
      description: '面向零基础学生的机器学习入门课程，涵盖监督学习、神经网络、SVM、集成学习等核心主题。',
      subject: 'computer_science',
      cover_url: '',
      teacher_name: '吴恩达',
      status: 'published',
      student_count: 7269,
      created_at: '2026-05-01T00:00:00Z',
    },
    {
      course_id: 2,
      title: '数据结构与算法',
      description: '基于 Python 实现的数据结构与算法课程。',
      subject: 'computer_science',
      cover_url: '',
      teacher_name: '李老师',
      status: 'published',
      student_count: 5831,
      created_at: '2026-05-05T00:00:00Z',
    },
    {
      course_id: 4,
      title: '高级数据库系统（草稿）',
      description: '正在编写中的数据库进阶课程。',
      subject: 'computer_science',
      cover_url: '',
      teacher_name: '李老师',
      status: 'draft',
      student_count: 0,
      created_at: '2026-05-20T00:00:00Z',
    },
  ]);

  teacherStore.setCourseMaterials([
    {
      material_id: 101,
      title: '第1章 机器学习导论',
      material_type: 'standardized_md',
      chapter: '1',
      section: '1.1',
      file_url: 'http://minio:9000/materials/course-1/ch01-standard.md',
      processing_status: 'completed',
      chunk_count: 12,
      created_at: '2026-05-01T10:00:00Z',
    },
    {
      material_id: 102,
      title: '第2章 模型评估与选择',
      material_type: 'standardized_md',
      chapter: '2',
      section: '2.1',
      file_url: 'http://minio:9000/materials/course-1/ch02-standard.md',
      processing_status: 'completed',
      chunk_count: 8,
      created_at: '2026-05-02T10:00:00Z',
    },
    {
      material_id: 103,
      title: '第3章 线性模型（原始PDF）',
      material_type: 'raw_pdf',
      chapter: '3',
      section: '3.1',
      file_url: 'http://minio:9000/materials/course-1/ch03-raw.pdf',
      processing_status: 'pending',
      created_at: '2026-05-25T14:00:00Z',
    },
  ]);
}
