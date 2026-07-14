-- ============================================
-- easyStudy — 演示数据填充（幂等，依赖 seed-data.py 先执行）
-- ============================================

-- 学生画像（幂等）
INSERT INTO student_profiles (student_id, course_id, profile, version)
SELECT u.id, 1, 
  CASE WHEN u.username = 'student_li' THEN '{"knowledge_base":{"label":"知识基础","score":45},"learning_style":{"label":"学习风格","score":70},"cognitive_level":{"label":"认知水平","score":35},"error_pattern":{"label":"易错模式","score":25},"motivation":{"label":"学习动机","score":80},"study_habit":{"label":"学习习惯","score":50}}'::jsonb
       ELSE '{"knowledge_base":{"label":"知识基础","score":65},"learning_style":{"label":"学习风格","score":55},"cognitive_level":{"label":"认知水平","score":60},"error_pattern":{"label":"易错模式","score":30},"motivation":{"label":"学习动机","score":75},"study_habit":{"label":"学习习惯","score":60}}'::jsonb
  END, 1
FROM users u
WHERE u.username IN ('student_li', 'student_zhang')
ON CONFLICT (student_id, course_id) DO NOTHING;

-- 学习路径
INSERT INTO learning_paths (student_id, course_id, profile_version, status)
SELECT u.id, 1, 1, 'active'
FROM users u WHERE u.username = 'student_li';
DO $$
DECLARE pid bigint;
BEGIN
  SELECT id INTO pid FROM learning_paths WHERE student_id = (SELECT id FROM users WHERE username='student_li') AND course_id=1;
  INSERT INTO learning_path_items (path_id, seq_order, item_type, title, description, estimated_minutes, dependencies, status) VALUES
    (pid, 1, 'chapter', 'Python 基础语法回顾', '变量、数据类型、条件语句、循环', 60, '[]'::jsonb, 'completed'),
    (pid, 2, 'chapter', '函数与模块',     '函数定义、参数、返回值、import',         90, '[1]'::jsonb, 'completed'),
    (pid, 3, 'exercise','基础语法练习',    '10道选择题+5道编程题',                  45, '[1,2]'::jsonb, 'in_progress'),
    (pid, 4, 'chapter', '面向对象编程',    '类、对象、继承、多态',                  120, '[2]'::jsonb, 'pending'),
    (pid, 5, 'chapter', '文件操作与异常处理','读写文件、with语句、try-except',       60, '[2]'::jsonb, 'pending'),
    (pid, 6, 'exercise','综合项目练习',    '学生管理系统CRUD实战',                  180, '[3,4,5]'::jsonb, 'pending')
  ON CONFLICT (path_id, seq_order) DO NOTHING;
END $$;

-- 对话 + 消息
DO $$
DECLARE cid1 bigint; cid2 bigint; sid bigint;
BEGIN
  SELECT id INTO sid FROM users WHERE username='student_li';
  INSERT INTO conversations (student_id, course_id, title) VALUES (sid, 1, 'Python 学习咨询') RETURNING id INTO cid1;
  INSERT INTO conversations (student_id, course_id, title) VALUES (sid, 1, '函数参数搞不懂') RETURNING id INTO cid2;
  
  INSERT INTO messages (conversation_id, role, content, created_at) VALUES
    (cid1, 'user', '你好，我刚开始学 Python，有什么建议吗？', NOW() - interval '2 hours'),
    (cid1, 'assistant', '你好！建议从基础语法开始，重点关注函数和模块部分。每天保持1-2小时练习 😊', NOW() - interval '2 hours' + interval '10 seconds'),
    (cid1, 'user', '列表推导式我总是写错，能帮我看看吗？', NOW() - interval '1 hour'),
    (cid1, 'assistant', '列表推导式的口诀：[表达式 for 变量 in 可迭代对象 if 条件]。比如 `[x**2 for x in range(1,11) if x%2==0]`', NOW() - interval '1 hour' + interval '15 seconds'),
    (cid2, 'user', '默认参数和关键字参数有什么区别？', NOW() - interval '30 minutes'),
    (cid2, 'assistant', '默认参数：定义时给默认值。关键字参数：调用时用参数名=值，可不按顺序。', NOW() - interval '30 minutes' + interval '8 seconds');
END $$;

-- 资源
INSERT INTO resources (student_id, course_id, resource_type, title, topic, content, is_validated, status)
SELECT u.id, 1, t.resource_type, t.title, t.topic, t.content, true, 'completed'
FROM users u, (VALUES
  ('student_li', 'document',    'Python 基础语法总结', '基础语法', '{"raw":"## Python基础\n- 变量与数据类型\n- 条件语句if/elif/else\n- 循环for/while"}'::jsonb),
  ('student_li', 'mind_map',    'Python 函数思维导图', '函数',    '{"raw":"# 函数\n- def关键字\n- 参数类型\n- 返回值"}'::jsonb),
  ('student_li', 'exercise_set','Python 基础练习',    '基础语法', '{"exercises":[{"id":1,"type":"choice","question":"Python不变类型是？","options":["list","dict","tuple","set"],"answer":2}]}'::jsonb)
) AS t(username, resource_type, title, topic, content)
WHERE u.username = t.username;

-- 课程详情
UPDATE courses SET description='从零开始学Python，涵盖基础语法、函数、面向对象、文件操作', status='published', updated_at=NOW() WHERE id=1;
