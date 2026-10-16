export interface MockTreeNode {
  key: string;
  title: string;
  children?: MockTreeNode[];
  isLeaf?: boolean;
}

export const mockMaterialTree: MockTreeNode[] = [
  {
    key: 'ch1',
    title: '第一章：机器学习导论',
    children: [
      { key: 'file-1-1', title: '1.1 什么是监督学习', isLeaf: true },
      { key: 'file-1-2', title: '1.2 线性回归基础理论', isLeaf: true },
      { key: 'file-1-3', title: '1.3 过拟合与欠拟合', isLeaf: true },
    ],
  },
  {
    key: 'ch2',
    title: '第二章：模型评估与选择',
    children: [
      { key: 'file-2-1', title: '2.1 评估方法（留出法、交叉验证）', isLeaf: true },
      { key: 'file-2-2', title: '2.2 性能度量（准确率、召回率）', isLeaf: true },
    ],
  },
  {
    key: 'ch3',
    title: '第三章：线性模型',
    children: [
      { key: 'file-3-1', title: '3.1 线性回归', isLeaf: true },
      { key: 'file-3-2', title: '3.2 逻辑回归', isLeaf: true },
    ],
  },
  {
    key: 'kb',
    title: '知识库附件',
    children: [
      { key: 'file-kg-1', title: '机器学习导论 · 知识图谱', isLeaf: true },
      { key: 'file-gl-1', title: '机器学习导论 · 术语表', isLeaf: true },
    ],
  },
];

export const mockMaterialContent: Record<string, string> = {
  'file-1-1': `# 1.1 什么是监督学习

监督学习（**Supervised Learning**）是机器学习中最核心、应用最广泛的范式。其基本思想是：利用一组**已知标签（Label）**的训练样本，让模型学习从输入到输出的映射关系，从而对未见过的数据进行预测。

简单类比：就像学生做练习题——每道题都有**标准答案**（标签）。学生通过反复练习，掌握了"题目→答案"的规律后，遇到新题也能作答。监督学习正是这个过程的数学抽象。

## 核心数学表示

\`\`\`
D = {(x₁, y₁), (x₂, y₂), ..., (xₙ, yₙ)}
xᵢ ∈ Rᵈ — 第 i 个样本的特征向量（d 维）
yᵢ — 第 i 个样本的标签（Ground Truth）
\`\`\`

目标：学习映射函数 f(x) ≈ y，使得在未见过的测试数据上也能准确预测。

## 回归与分类

监督学习按输出类型分为两大类别：
- **回归（Regression）**：预测连续值（如房价：350 万元）
- **分类（Classification）**：预测离散标签（如垃圾邮件：是/否）

## 常见算法

- 线性回归 / 逻辑回归
- 决策树 / 随机森林
- SVM（支持向量机）
- KNN（K 近邻）
- 神经网络
`,
  'file-1-2': `# 1.2 线性回归基础理论

线性回归是监督学习中最基础、最直观的模型。它假设目标变量 y 与特征 x 之间存在线性关系。

## 模型形式

$$y = w^T x + b = \\sum_{j=1}^{d} w_j x_j + b$$

其中 w 是权重向量，b 是偏置项。

## 损失函数

采用均方误差（MSE）：

$$L(w, b) = \\frac{1}{n} \\sum_{i=1}^{n} (y_i - \\hat{y}_i)^2$$

## 优化方法

- **解析解**：正规方程（Normal Equation）
- **迭代解**：梯度下降（Gradient Descent）
`,
};
