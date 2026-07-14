import { useLearningPathStore } from '../stores/learningPathStore';
import type { LearningPath } from '../types/learningPath';
import { assignDepths } from '../utils/dagreLayout';

const mockPath: LearningPath = {
  id: 'path-001',
  courseId: 1,
  courseTitle: '机器学习基础',
  createdAt: '2026-05-25T08:00:00Z',
  updatedAt: '2026-05-27T10:00:00Z',
  overallProgress: 20,
  nodes: assignDepths([
    {
      id: '1',
      backendItemId: 1,
      title: '机器学习概览',
      summary: '了解机器学习的定义、分类与应用场景',
      itemType: 'chapter',
      itemRefId: 1,
      status: 'completed',
      estimatedMinutes: 30,
      dependencies: [],
      depth: 0,
      detail: {
        description: '了解机器学习的定义、分类（监督/无监督/强化学习）与应用场景，建立整体认知框架。',
        learningPoints: ['机器学习的定义与历史', '监督学习 vs 无监督学习 vs 强化学习', '常见应用场景', '机器学习项目流程'],
        resources: [
          { title: 'Machine Learning Crash Course (Google)', url: 'https://developers.google.com/machine-learning/crash-course', type: 'video' },
          { title: '机器学习入门指南', type: 'article' },
        ],
        difficulty: 'beginner',
      },
    },
    {
      id: '2',
      backendItemId: 2,
      title: '线性回归基础',
      summary: '掌握最小二乘法与梯度下降法',
      itemType: 'chapter',
      itemRefId: 2,
      status: 'in_progress',
      estimatedMinutes: 60,
      dependencies: ['1'],
      depth: 0,
      detail: {
        description: '掌握最小二乘法、梯度下降法，理解损失函数与参数优化，实现第一个机器学习模型。',
        learningPoints: ['线性回归的数学原理', '最小二乘法推导', '梯度下降算法', '学习率调优', '过拟合初探'],
        resources: [
          { title: 'Linear Regression Explained', url: 'https://www.youtube.com/watch?v=nk2CQITm_eo', type: 'video' },
          { title: '梯度下降可视化', type: 'exercise' },
        ],
        difficulty: 'beginner',
      },
    },
    {
      id: '3',
      backendItemId: 3,
      title: '逻辑回归与分类',
      summary: '学习二分类与多分类模型',
      itemType: 'chapter',
      itemRefId: 3,
      status: 'pending',
      estimatedMinutes: 50,
      dependencies: ['2'],
      depth: 0,
      detail: {
        description: '学习 sigmoid 函数、交叉熵损失，实现二分类与多分类模型，理解分类评估指标。',
        learningPoints: ['Sigmoid 函数与概率输出', '交叉熵损失函数', '决策边界可视化', '混淆矩阵与评估指标'],
        resources: [
          { title: 'Logistic Regression Deep Dive', type: 'video' },
          { title: '分类模型练习', type: 'exercise' },
        ],
        difficulty: 'intermediate',
      },
    },
    {
      id: '4',
      backendItemId: 4,
      title: '正则化与模型选择',
      summary: '理解过拟合与正则化技术',
      itemType: 'chapter',
      itemRefId: 4,
      status: 'pending',
      estimatedMinutes: 45,
      dependencies: ['2'],
      depth: 0,
      detail: {
        description: '理解过拟合、L1/L2 正则化，掌握交叉验证与模型评估指标（AUC、F1 等）。',
        learningPoints: ['偏差-方差权衡', 'L1（Lasso）vs L2（Ridge）', '交叉验证方法', 'AUC、F1、PR 曲线'],
        resources: [
          { title: 'Regularization Explained', type: 'article' },
        ],
        difficulty: 'intermediate',
      },
    },
    {
      id: '5',
      backendItemId: 5,
      title: '决策树与集成方法',
      summary: '学习随机森林与梯度提升',
      itemType: 'chapter',
      itemRefId: 5,
      status: 'pending',
      estimatedMinutes: 70,
      dependencies: ['3', '4'],
      depth: 0,
      detail: {
        description: '学习 ID3、CART 算法，理解随机森林与梯度提升树原理，掌握特征重要性分析。',
        learningPoints: ['信息增益与基尼系数', '决策树剪枝', 'Bagging 与随机森林', 'Boosting 与 XGBoost', '特征重要性'],
        resources: [
          { title: 'XGBoost 官方文档', url: 'https://xgboost.readthedocs.io/', type: 'book' },
          { title: 'Random Forest Visualization', type: 'exercise' },
        ],
        difficulty: 'intermediate',
      },
    },
    {
      id: '6',
      backendItemId: 6,
      title: '支持向量机',
      summary: '掌握 SVM 间隔最大化思想',
      itemType: 'chapter',
      itemRefId: 6,
      status: 'pending',
      estimatedMinutes: 55,
      dependencies: ['4'],
      depth: 0,
      detail: {
        description: '掌握 SVM 的间隔最大化思想，理解核技巧与非线性分类，学习软间隔 SVM。',
        learningPoints: ['最大间隔分类器', '对偶问题', '核函数（RBF、多项式）', '软间隔与正则化参数 C'],
        resources: [
          { title: 'SVM Tutorial (MIT)', type: 'video' },
        ],
        difficulty: 'advanced',
      },
    },
    {
      id: '7',
      backendItemId: 7,
      title: '神经网络入门',
      summary: '学习多层感知机与反向传播',
      itemType: 'chapter',
      itemRefId: 7,
      status: 'pending',
      estimatedMinutes: 80,
      dependencies: ['5', '6'],
      depth: 0,
      detail: {
        description: '了解感知机、多层前馈网络，实现反向传播算法，为深度学习打下基础。',
        learningPoints: ['感知机模型', '激活函数（ReLU、tanh、sigmoid）', '反向传播推导', '用 NumPy 实现 MLP', '深度学习框架概览'],
        resources: [
          { title: '3Blue1Brown 神经网络系列', url: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi', type: 'video' },
          { title: '手写数字识别练习', type: 'exercise' },
        ],
        difficulty: 'advanced',
      },
    },
  ]),
};

export function seedPathMock() {
  useLearningPathStore.getState().setLoading(false);
  // 直接设置 path 
  useLearningPathStore.setState({ path: mockPath, hasQuestionnaire: true });
}
