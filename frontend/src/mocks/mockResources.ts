import { useResourceStore } from '../stores/resourceStore';
import type { Resource } from '../types/resource';

const mockResources: Resource[] = [
  {
    id: 'res-doc-001',
    resource_type: 'document',
    title: '线性回归知识点总结',
    content: `## 线性回归（Linear Regression）

### 1. 基本模型
$$y = Xw + b + \\epsilon$$

其中：
- $X \\in \\mathbb{R}^{n \\times d}$ 为特征矩阵
- $w \\in \\mathbb{R}^{d}$ 为权重向量
- $b$ 为偏置项

### 2. 损失函数（MSE）
$$L(w,b) = \\frac{1}{n} \\sum_{i=1}^{n} (y_i - \\hat{y}_i)^2$$

### 3. 解析解
$$\\hat{w} = (X^T X)^{-1} X^T y$$

### 4. 梯度下降更新
$$w_{t+1} = w_t - \\eta \\nabla_w L$$

---

> 关键理解：线性回归假设目标变量与特征之间存在线性关系，通过最小化预测误差的平方和来估计参数。`,
    courseId: 1,
    topic: '线性回归',
    createdAt: '2026-05-26T10:30:00Z',
    status: 'completed',
  },
  {
    id: 'res-map-001',
    resource_type: 'mermaid',
    title: '监督学习思维导图',
    content: `graph TD
    A[监督学习] --> B[回归]
    A --> C[分类]
    B --> D[线性回归]
    B --> E[多项式回归]
    C --> F[逻辑回归]
    C --> G[SVM]
    C --> H[决策树]
    H --> I[随机森林]
    H --> J[梯度提升树]
    D --> K[最小二乘法]
    D --> L[梯度下降]`,
    courseId: 1,
    topic: '监督学习',
    createdAt: '2026-05-26T11:00:00Z',
    status: 'completed',
  },
  {
    id: 'res-exe-001',
    resource_type: 'exercise_set',
    title: '逻辑回归练习题',
    content: `### 练习题 1：sigmoid 函数
已知 sigmoid 函数 $\\sigma(z) = \\frac{1}{1 + e^{-z}}$，证明当 $z = 0$ 时，$\\sigma(0) = 0.5$。

**答案**：
$$\\sigma(0) = \\frac{1}{1 + e^{0}} = \\frac{1}{2} = 0.5$$

---

### 练习题 2：交叉熵损失
二分类问题的交叉熵损失函数为：
$$L = -[y \\log(\\hat{y}) + (1-y) \\log(1-\\hat{y})]$$

当真实标签 $y=1$，预测概率 $\\hat{y}=0.9$ 时，计算损失值。

**答案**：
$$L = -[1 \\times \\log(0.9) + 0] \\approx 0.105$$

---

### 练习题 3：梯度计算
推导逻辑回归对权重 $w_j$ 的梯度：
$$\\frac{\\partial L}{\\partial w_j} = \\frac{1}{n} \\sum_{i=1}^{n} (\\hat{y}_i - y_i) x_{ij}$$`,
    courseId: 1,
    topic: '逻辑回归',
    createdAt: '2026-05-26T14:00:00Z',
    status: 'completed',
  },
  {
    id: 'res-code-001',
    resource_type: 'code_case',
    title: 'NumPy 实现线性回归',
    content: `\`\`\`python
import numpy as np

def linear_regression(X, y, lr=0.01, epochs=1000):
    """
    使用梯度下降实现线性回归
    
    Args:
        X: (n_samples, n_features) 特征矩阵
        y: (n_samples,) 目标向量
        lr: 学习率
        epochs: 迭代次数
    """
    n_samples, n_features = X.shape
    
    # 初始化权重和偏置
    w = np.zeros(n_features)
    b = 0
    
    for epoch in range(epochs):
        # 前向传播
        y_pred = np.dot(X, w) + b
        
        # 计算梯度
        dw = (1 / n_samples) * np.dot(X.T, (y_pred - y))
        db = (1 / n_samples) * np.sum(y_pred - y)
        
        # 更新参数
        w -= lr * dw
        b -= lr * db
        
        # 每 100 轮打印损失
        if epoch % 100 == 0:
            loss = np.mean((y_pred - y) ** 2)
            print(f'Epoch {epoch}, Loss: {loss:.4f}')
    
    return w, b

# 使用示例
X = np.random.randn(100, 3)
true_w = np.array([2.0, -1.0, 0.5])
y = np.dot(X, true_w) + 3.0 + np.random.randn(100) * 0.1

w, b = linear_regression(X, y)
print(f'Learned w: {w}')
print(f'Learned b: {b:.4f}')
\`\`\``,
    courseId: 1,
    topic: '线性回归实现',
    createdAt: '2026-05-26T15:30:00Z',
    status: 'completed',
  },
  {
    id: 'res-read-001',
    resource_type: 'reading_material',
    title: '贝叶斯方法入门拓展阅读',
    content: `## 延伸阅读：贝叶斯视角下的机器学习

### 推荐阅读
1. **《Pattern Recognition and Machine Learning》** — Bishop
   - 第 1-3 章：概率论基础与贝叶斯决策理论
   
2. **《Bayesian Methods for Hackers》** — Cam Davidson-Pilon
   - 面向实践的贝叶斯推断教程

### 核心概念
- **先验分布** $P(\\theta)$：对参数的初始信念
- **似然** $P(D|\\theta)$：数据在给定参数下的概率
- **后验分布** $P(\\theta|D) \\propto P(D|\\theta)P(\\theta)$

### 与频率派对比
| 维度 | 频率派 | 贝叶斯派 |
|------|--------|----------|
| 参数 | 固定未知常数 | 随机变量 |
| 估计 | 点估计（MLE） | 后验分布 |
| 不确定性 | 置信区间 | 可信区间 |
| 小数据 | 效果差 | 先验可发挥作用 |

> 提示：本章只要求理解贝叶斯思想，不要求掌握变分推断或 MCMC 采样。`,
    courseId: 1,
    topic: '贝叶斯方法',
    createdAt: '2026-05-26T16:00:00Z',
    status: 'completed',
  },
];

export function seedResourceMock() {
  useResourceStore.getState().setResources(mockResources);
}
