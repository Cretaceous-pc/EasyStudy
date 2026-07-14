-- ═══════════════════════════════════════════════════════════
-- easyStudy — 数据库初始化 DDL
-- 生成日期: 2026-05-27
-- 对应文档: easyStudy-数据库表设计.md §二
-- 
-- ⚠️ 重要：此脚本仅在 PostgreSQL 容器**首次创建**时执行
--   （挂载到 /docker-entrypoint-initdb.d/，数据卷为空时运行）
--   后续重启不会再次执行，数据持久化在 postgres_data 卷中
--   如需完全重置：docker compose down -v && docker compose up -d
-- ═══════════════════════════════════════════════════════════

-- 开发环境：方便重复执行
DROP TABLE IF EXISTS knowledge_chunks CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS learning_path_items CASCADE;
DROP TABLE IF EXISTS learning_paths CASCADE;
DROP TABLE IF EXISTS exercise_attempts CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS student_behavior_logs CASCADE;
DROP TABLE IF EXISTS profile_snapshots CASCADE;
DROP TABLE IF EXISTS student_profiles CASCADE;
DROP TABLE IF EXISTS course_materials CASCADE;
DROP TABLE IF EXISTS course_enrollments CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ═══════════════════════════════════════════════════════════
-- §2.1 用户与权限 (Spring Boot 主后端)
-- ═══════════════════════════════════════════════════════════

-- users — 用户基础表
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    email VARCHAR(128) UNIQUE,
    display_name VARCHAR(64) NOT NULL,
    avatar_url VARCHAR(512),
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- roles — 角色表
CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(32) UNIQUE NOT NULL
);

-- 初始化角色数据
INSERT INTO roles (name) VALUES ('ROLE_STUDENT'), ('ROLE_TEACHER'), ('ROLE_ADMIN');

-- user_roles — 用户-角色关联 (多对多)
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ═══════════════════════════════════════════════════════════
-- §2.2 课程与资料 (Spring Boot 主后端)
-- ═══════════════════════════════════════════════════════════

-- courses — 课程表
CREATE TABLE courses (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    subject VARCHAR(64),
    cover_url VARCHAR(512),
    teacher_id BIGINT REFERENCES users(id),
    status VARCHAR(16) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- course_enrollments — 选课关系
CREATE TABLE course_enrollments (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(16) DEFAULT 'active',
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    dropped_at TIMESTAMPTZ,
    UNIQUE (student_id, course_id)
);

-- course_materials — 课程资料 (原始上传 + 标准化 MD)
CREATE TABLE course_materials (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(256) NOT NULL,
    material_type VARCHAR(32) NOT NULL,
    file_url VARCHAR(512) NOT NULL,
    file_size BIGINT,
    chapter VARCHAR(64),
    section VARCHAR(64),
    processing_status VARCHAR(32) DEFAULT 'pending',
    processing_error TEXT,
    chunk_count INTEGER,
    uploaded_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引：按课程+章节快速定位资料
CREATE INDEX idx_materials_course_chapter ON course_materials(course_id, chapter, section);

-- ═══════════════════════════════════════════════════════════
-- §2.3 学生画像 (FastAPI AI后端 & Spring Boot 共享读)
-- ═══════════════════════════════════════════════════════════

-- student_profiles — 学生画像 (每学生每课程一条)
CREATE TABLE student_profiles (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    profile JSONB NOT NULL DEFAULT '{}',
    version INTEGER DEFAULT 1,
    confidence JSONB DEFAULT '{}',
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, course_id)
);

-- profile_snapshots — 画像快照 (用于趋势分析)
CREATE TABLE profile_snapshots (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    profile JSONB NOT NULL,
    version INTEGER NOT NULL,
    trigger VARCHAR(32),
    snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_student_course ON profile_snapshots(student_id, course_id, snapshot_at);

-- ═══════════════════════════════════════════════════════════
-- §2.4 行为日志 (FastAPI AI后端写入)
-- ═══════════════════════════════════════════════════════════

-- student_behavior_logs — 学习行为日志
CREATE TABLE student_behavior_logs (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 按学生+时间查询行为流
CREATE INDEX idx_behavior_student_time ON student_behavior_logs(student_id, course_id, created_at);
-- 按事件类型统计
CREATE INDEX idx_behavior_type ON student_behavior_logs(event_type, created_at);

-- ═══════════════════════════════════════════════════════════
-- §2.5 学习资源 (FastAPI AI后端写入, Spring Boot 读)
-- ═══════════════════════════════════════════════════════════

-- resources — 生成的个性化资源
CREATE TABLE resources (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    resource_type VARCHAR(32) NOT NULL,
    title VARCHAR(256) NOT NULL,
    topic VARCHAR(128),
    content JSONB NOT NULL,
    prompt_used TEXT,
    source_chunks JSONB,
    generation_cost JSONB,
    is_validated BOOLEAN DEFAULT FALSE,
    validation_notes TEXT,
    status VARCHAR(16) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 按学生+课程查询资源列表
CREATE INDEX idx_resources_student_course ON resources(student_id, course_id, created_at);
-- 按类型过滤
CREATE INDEX idx_resources_type ON resources(resource_type);

-- ═══════════════════════════════════════════════════════════
-- §2.6 练习记录 (FastAPI AI后端写入)
-- ═══════════════════════════════════════════════════════════

-- exercise_attempts — 学生答题记录
CREATE TABLE exercise_attempts (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    exercise_index INTEGER NOT NULL,
    student_answer JSONB NOT NULL,
    is_correct BOOLEAN,
    time_spent_sec INTEGER,
    attempt_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 按学生+练习集查询答题历史
CREATE INDEX idx_attempts_student_resource ON exercise_attempts(student_id, resource_id);

-- ═══════════════════════════════════════════════════════════
-- §2.7 学习路径 (FastAPI AI后端)
-- ═══════════════════════════════════════════════════════════

-- learning_paths — 个性化学习路径
CREATE TABLE learning_paths (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    profile_version INTEGER NOT NULL,
    status VARCHAR(16) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- learning_path_items — 路径节点
CREATE TABLE learning_path_items (
    id BIGSERIAL PRIMARY KEY,
    path_id BIGINT NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    seq_order INTEGER NOT NULL,
    item_type VARCHAR(32) NOT NULL,
    item_ref_id BIGINT,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    estimated_minutes INTEGER,
    dependencies JSONB DEFAULT '[]'::jsonb,
    detail JSONB DEFAULT '{}'::jsonb,
    teach_content TEXT DEFAULT '',
    status VARCHAR(16) DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    UNIQUE (path_id, seq_order)
);

-- ═══════════════════════════════════════════════════════════
-- §2.8 对话记录 (共享)
-- ═══════════════════════════════════════════════════════════

-- conversations — 对话会话
CREATE TABLE conversations (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id BIGINT REFERENCES courses(id),
    material_id BIGINT,  -- 课件引用（松散关联，非外键约束）
    context_type VARCHAR(32) DEFAULT 'general',
    title VARCHAR(256),
    status VARCHAR(16) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 按课件查活跃会话
CREATE INDEX idx_conv_material ON conversations(student_id, course_id, material_id) WHERE status = 'active';

-- messages — 对话消息
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- ═══════════════════════════════════════════════════════════
-- §2.9 知识库元数据 (FastAPI AI后端)
-- ═══════════════════════════════════════════════════════════

-- knowledge_chunks — 向量块元数据
CREATE TABLE knowledge_chunks (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    material_id BIGINT REFERENCES course_materials(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_hash VARCHAR(64),
    vector_id VARCHAR(128),
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (material_id, chunk_index)
);

-- 按课程快速检索所有 chunk
CREATE INDEX idx_chunks_course ON knowledge_chunks(course_id);
-- 向量反向查找
CREATE INDEX idx_chunks_vector_id ON knowledge_chunks(vector_id);

-- ═══════════════════════════════════════════════════════════
-- DDL 完成 — 共 16 张表 + 索引
-- ═══════════════════════════════════════════════════════════
