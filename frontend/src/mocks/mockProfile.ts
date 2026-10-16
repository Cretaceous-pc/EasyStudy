import { useProfileStore } from '../stores/profileStore';
import type { StudentProfile, ProfileSnapshot } from '../types/profile';

const mockProfile: StudentProfile = {
  student_id: 1,
  course_id: 1,
  version: 3,
  updated_at: '2026-05-27T10:00:00Z',
  summary:
    '张三同学在机器学习基础课程中展现出较强的数学推导能力，偏好视觉化学习材料。近期在逻辑回归章节遇到一定困难，建议加强梯度下降相关的代码实践练习。',
  dimensions: [
    {
      key: 'knowledge_base',
      label: '知识基础',
      value: 72,
      description: '对数学基础、编程能力的掌握程度',
    },
    {
      key: 'learning_goal',
      label: '学习目标',
      value: 85,
      description: '学习动机强度与目标清晰度',
    },
    {
      key: 'cognitive_style',
      label: '认知风格',
      value: 60,
      description: '偏好视觉/听觉/实践型学习',
    },
    {
      key: 'weak_points',
      label: '易错点',
      value: 45,
      description: '薄弱知识点的识别与改进',
    },
    {
      key: 'pace_preference',
      label: '节奏偏好',
      value: 70,
      description: '喜欢快节奏还是深度学习',
    },
    {
      key: 'engagement',
      label: '参与度',
      value: 78,
      description: '主动提问、练习完成的积极程度',
    },
  ],
};

const mockHistory: ProfileSnapshot[] = [
  {
    id: 'snap-001',
    createdAt: '2026-05-20T08:00:00Z',
    trigger: '冷启动对话',
    summary: '初始画像建立',
  },
  {
    id: 'snap-002',
    createdAt: '2026-05-24T14:00:00Z',
    trigger: '错题≥3次',
    summary: '梯度下降相关错题触发更新',
  },
];

export function seedProfileMock() {
  useProfileStore.getState().setProfile(mockProfile);
  // 注意: ProfileStore 没有 setHistory，历史通过 fetchHistory 加载，
  // 其快照结构含前端生成的 summary（见 profileStore 中的映射）。
  useProfileStore.setState({ history: mockHistory });
}
