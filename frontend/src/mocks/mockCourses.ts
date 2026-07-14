import { useCourseStore } from '../stores/courseStore';

export function seedCourseMock() {
  useCourseStore.getState().setAllCourses([
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
      description: '基于 Python 实现的数据结构与算法课程，MIT 6.006 风格。',
      subject: 'computer_science',
      cover_url: '',
      teacher_name: 'MIT 6.006',
      status: 'published',
      student_count: 5831,
      created_at: '2026-05-05T00:00:00Z',
    },
    {
      course_id: 3,
      title: '深度学习之计算机视觉',
      description: 'CS231n 风格，涵盖 CNN、ResNet、YOLO、GAN、Transformer。',
      subject: 'computer_science',
      cover_url: '',
      teacher_name: 'CS231n',
      status: 'published',
      student_count: 1719,
      created_at: '2026-05-10T00:00:00Z',
    },
  ]);

  useCourseStore.getState().setEnrolledCourses([
    {
      course_id: 1,
      title: '机器学习基础',
      description: '面向零基础学生的机器学习入门课程',
      subject: 'computer_science',
      cover_url: '',
      teacher_name: '吴恩达',
      status: 'published',
      student_count: 7269,
      created_at: '2026-05-01T00:00:00Z',
    },
  ]);
}
