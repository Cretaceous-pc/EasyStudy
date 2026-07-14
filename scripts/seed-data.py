#!/usr/bin/env python3
"""
easyStudy — 测试数据填充脚本
产出: 1 管理员 + 1 教师 + 3 学生 + 1 门课程 + 3 章资料
前置: init-db.sql 已执行, postgres 容器运行中
"""

import os
import sys
import psycopg2
from psycopg2.extras import Json

# ── 连接配置 (从环境变量读取，默认使用 .env 中的值) ──
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "easystudy")
DB_USER = os.getenv("DB_USER", "easystudy")
DB_PASSWORD = os.getenv("DB_PASSWORD", "easystudy_dev_2026")

# BCrypt 哈希值 — 明文均为 "Test@12345"
# 生成方式: bcrypt.hashpw(b"Test@12345", bcrypt.gensalt(rounds=10))
BCRYPT_TEST_PASSWORD = "$2b$10$FgjkbF1MuPvid5VJMxr0me3oLDZU2EgdQZ5dl7z2GmDkrO39p3qj6"


def get_connection():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )


def seed_users(cur):
    """插入 1 管理员 + 1 教师 + 3 学生"""
    users = [
        # (username, password_hash, email, display_name, role_name)
        ("admin",        BCRYPT_TEST_PASSWORD, "admin@easystudy.edu",    "系统管理员", "ROLE_ADMIN"),
        ("teacher_wang", BCRYPT_TEST_PASSWORD, "wang@easystudy.edu",     "王老师",     "ROLE_TEACHER"),
        ("student_li",   BCRYPT_TEST_PASSWORD, "li@easystudy.edu",       "李同学",     "ROLE_STUDENT"),
        ("student_zhang",BCRYPT_TEST_PASSWORD, "zhang@easystudy.edu",    "张同学",     "ROLE_STUDENT"),
        ("student_liu",  BCRYPT_TEST_PASSWORD, "liu@easystudy.edu",      "刘同学",     "ROLE_STUDENT"),
    ]

    for username, pw_hash, email, display_name, role_name in users:
        cur.execute(
            """INSERT INTO users (username, password_hash, email, display_name)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (username) DO NOTHING
               RETURNING id""",
            (username, pw_hash, email, display_name)
        )
        row = cur.fetchone()
        if row:
            user_id = row[0]
            cur.execute(
                """INSERT INTO user_roles (user_id, role_id)
                   SELECT %s, id FROM roles WHERE name = %s
                   ON CONFLICT (user_id, role_id) DO NOTHING""",
                (user_id, role_name)
            )
            print(f"  ✓ 用户 {username} (id={user_id}, role={role_name})")
        else:
            # 用户已存在，跳过
            user_id = _get_user_id(cur, username)
            print(f"  - 用户 {username} 已存在 (id={user_id})，跳过")

    return {u[0]: _get_user_id(cur, u[0]) for u in users}


def _get_user_id(cur, username):
    cur.execute("SELECT id FROM users WHERE username = %s", (username,))
    return cur.fetchone()[0]


def seed_courses(cur, teacher_id):
    """插入课程（幂等）"""
    cur.execute("SELECT id FROM courses WHERE title = 'Python 编程基础'")
    existing = cur.fetchone()
    if existing:
        print(f"  - 课程 'Python 编程基础' 已存在 (id={existing[0]})，跳过")
        return existing[0]
    cur.execute(
        """INSERT INTO courses (title, description, subject, teacher_id, status)
           VALUES (%s, %s, %s, %s, %s) RETURNING id""",
        ("Python 编程基础", "从零开始学习 Python 编程，涵盖语法基础、数据结构、算法入门",
         "computer_science", teacher_id, "published")
    )
    course_id = cur.fetchone()[0]
    print(f"  ✓ 课程 'Python 编程基础' (id={course_id})")
    return course_id


def seed_enrollments(cur, course_id, student_ids):
    """3 个学生全部选课"""
    for sid in student_ids:
        cur.execute(
            """INSERT INTO course_enrollments (student_id, course_id, status)
               VALUES (%s, %s, 'active')""",
            (sid, course_id)
        )
    print(f"  ✓ {len(student_ids)} 名学生选课成功")


def seed_materials(cur, course_id, teacher_id):
    """插入 3 章课程资料"""
    materials = [
        ("第1章 Python 基础语法", "raw_md", "1", "1.1", "completed"),
        ("第2章 数据结构与算法", "raw_md", "2", "2.1", "completed"),
        ("第3章 面向对象编程",   "raw_pdf", "3", "3.1", "pending"),
    ]
    for title, mtype, chapter, section, status in materials:
        cur.execute(
            """INSERT INTO course_materials
               (course_id, title, material_type, file_url, chapter, section, processing_status, uploaded_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (course_id, title, mtype, f"materials/{chapter}/{title}.md",
             chapter, section, status, teacher_id)
        )
    print(f"  ✓ {len(materials)} 份课程资料")


def main():
    print("🚀 easyStudy 测试数据填充")
    print(f"   连接: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

    try:
        conn = get_connection()
        cur = conn.cursor()
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        sys.exit(1)

    try:
        # 幂等插入 — 不删除已有数据，已存在的记录自动跳过
        print("\n── 填充用户（幂等，已存在则跳过）──")
        user_ids = seed_users(cur)

        print("\n── 填充课程 ──")
        course_id = seed_courses(cur, user_ids["teacher_wang"])

        print("\n── 填充选课 ──")
        student_ids = [user_ids["student_li"], user_ids["student_zhang"], user_ids["student_liu"]]
        seed_enrollments(cur, course_id, student_ids)

        print("\n── 填充资料 ──")
        seed_materials(cur, course_id, user_ids["teacher_wang"])

        conn.commit()
        print("\n✅ 测试数据填充完成！")

        # 验证
        print("\n── 验证 ──")
        for table in ["users", "roles", "user_roles", "courses", "course_enrollments", "course_materials"]:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            print(f"  {table}: {count} 条记录")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ 填充失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
