#!/bin/bash
# ═══════════════════════════════════════════════════════
# easyStudy — 插入测试数据 (Linux)
# 用法: bash scripts/seed-data.sh
# ═══════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  easyStudy -- 插入测试数据"
echo "============================================"
echo ""

# ── 第一步：用户 + 课程 ──
echo "第一步：插入用户和课程..."
python "$SCRIPT_DIR/seed-data.py"
if [ $? -ne 0 ]; then
    echo "❌ 第一步失败！请确认 Docker 正在运行。"
    exit 1
fi
echo ""

# ── 第二步：演示数据 ──
echo "第二步：插入演示数据（对话、资源、路径）..."
cat "$SCRIPT_DIR/seed-test-data.sql" | docker exec -i easystudy-postgres psql -U easystudy -d easystudy 2>/dev/null
echo ""

echo "============================================"
echo "  完成！"
echo ""
echo "  测试账号:"
echo "    管理员: admin / Test@12345"
echo "    教师:   teacher_wang / Test@12345"
echo "    学生:   student_li / Test@12345"
echo ""
echo "  种子脚本可重复运行，已存在用户不会被覆盖。"
echo "============================================"
