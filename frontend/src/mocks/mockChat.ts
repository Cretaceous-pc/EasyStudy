import { useChatStore } from '../stores/chatStore';

export function seedChatMock() {
  useChatStore.getState().setMessages([
    {
      message_id: 1,
      role: 'user',
      content: '帮我总结一下第一章的核心概念',
      created_at: '2026-05-27T10:00:00Z',
    },
    {
      message_id: 2,
      role: 'assistant',
      content: '第一章「机器学习导论」的核心概念可以概括为以下三点：\n\n① **监督学习**：利用带标签数据训练模型，分为回归（连续值）和分类（离散标签）\n② **特征与标签**：x 是输入特征，y 是目标标签，模型学习 f(x)→y 的映射\n③ **泛化能力**：训练集表现好 ≠ 测试集表现好，需警惕过拟合',
      created_at: '2026-05-27T10:00:05Z',
    },
    {
      message_id: 3,
      role: 'user',
      content: '能生成一个思维导图吗？',
      created_at: '2026-05-27T10:01:00Z',
    },
    {
      message_id: 4,
      role: 'assistant',
      content: '已为您生成「机器学习导论」思维导图，涵盖：监督/非监督/强化学习三大范式、损失函数体系、评估指标矩阵、以及常见算法族谱。点击下方卡片查看完整内容。',
      created_at: '2026-05-27T10:01:10Z',
    },
    {
      message_id: 5,
      role: 'user',
      content: '损失函数和评估指标有什么区别？',
      created_at: '2026-05-27T10:02:00Z',
    },
    {
      message_id: 6,
      role: 'assistant',
      content: '**损失函数**是模型训练时的优化目标（如 MSE、交叉熵），指导参数更新方向。**评估指标**是训练完成后衡量模型性能的标尺（如准确率、F1、AUC），反映业务层面的效果。两者不一定一致——训练用交叉熵，评估可能更关注 F1。',
      created_at: '2026-05-27T10:02:08Z',
    },
    {
      message_id: 7,
      role: 'user',
      content: '逻辑回归为什么叫回归？',
      created_at: '2026-05-27T10:03:00Z',
    },
    {
      message_id: 8,
      role: 'assistant',
      content: '它内部先做线性回归（z = wx + b），再通过 Sigmoid 函数把连续值映射到 (0,1) 概率，最后按阈值分类。所以「回归」是内功，「分类」是外显。类似的还有 Softmax 回归——本质都是广义线性模型。',
      created_at: '2026-05-27T10:03:06Z',
    },
  ]);
}
