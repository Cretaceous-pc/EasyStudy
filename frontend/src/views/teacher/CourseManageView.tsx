import { useState, useEffect } from 'react';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import { useTeacherStore } from '../../stores';
import AppModal from '../../components/shared/AppModal';
import type { Course } from '../../types/course';

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  published: { label: '已发布', color: '#2e7d32', bg: '#e8f5e9' },
  draft: { label: '草稿', color: '#ed6c02', bg: '#fff3e0' },
  archived: { label: '已归档', color: '#757575', bg: '#f5f5f5' },
};

export default function CourseManageView() {
  const { myCourses, addCourse, updateCourse, removeCourse, fetchMyCourses, createCourse, updateCourseAPI, removeCourseAPI } = useTeacherStore();
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', subject: 'computer_science' });

  // 加载教师课程列表
  useEffect(() => {
    fetchMyCourses();
  }, [fetchMyCourses]);

  const openCreate = () => {
    setEditingCourse(null);
    setFormData({ title: '', description: '', subject: 'computer_science' });
    setShowModal(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({ title: course.title, description: course.description || '', subject: course.subject });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;

    if (editingCourse) {
      await updateCourseAPI(editingCourse.course_id, {
        title: formData.title,
        description: formData.description,
      });
    } else {
      await createCourse({
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
      });
    }
    setShowModal(false);
  };

  const handleDelete = async (courseId: number) => {
    if (confirm('确定要删除这门课程吗？此操作不可恢复。')) {
      await removeCourseAPI(courseId);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 顶部操作栏 */}
      <div
        className="flex items-center justify-between px-6 flex-shrink-0"
        style={{ height: 56, borderBottom: '1px solid var(--border-cream)' }}
      >
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, color: 'var(--near-black)', margin: 0 }}>
          课程管理
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none cursor-pointer text-white text-xs font-medium"
          style={{ background: 'var(--accent)', transition: 'all 0.2s' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
          }}
        >
          <PlusOutlined style={{ fontSize: 12 }} />
          新建课程
        </button>
      </div>

      {/* 课程列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {myCourses.map((course) => {
            const status = statusMap[course.status] || statusMap.draft;
            return (
              <div
                key={course.course_id}
                className="rounded-xl p-5 flex flex-col gap-3"
                style={{
                  background: 'var(--ivory)',
                  boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
                  border: '1px solid var(--border-cream)',
                  transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(42,27,24,0.04)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(42,27,24,0.03)';
                  e.currentTarget.style.transform = '';
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="truncate"
                      style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500, color: 'var(--near-black)', margin: '0 0 4px' }}
                    >
                      {course.title}
                    </h3>
                    <p className="truncate" style={{ fontSize: 12, color: 'var(--stone-gray)', margin: 0 }}>
                      {course.description || '暂无描述'}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium ml-2"
                    style={{ color: status.color, background: status.bg }}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--stone-gray)' }}>
                  <span>{course.student_count} 名学生</span>
                  <span>{course.subject}</span>
                </div>

                <div className="flex items-center gap-1 pt-2" style={{ borderTop: '1px solid var(--border-cream)' }}>
                  <button
                    onClick={() => openEdit(course)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border-none cursor-pointer text-xs"
                    style={{ color: 'var(--olive-gray)', background: 'transparent', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--warm-sand)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <EditOutlined style={{ fontSize: 11 }} />
                    编辑
                  </button>
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded-md border-none cursor-pointer text-xs"
                    style={{ color: 'var(--olive-gray)', background: 'transparent', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--warm-sand)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <EyeOutlined style={{ fontSize: 11 }} />
                    预览
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => handleDelete(course.course_id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border-none cursor-pointer text-xs"
                    style={{ color: 'var(--error-crimson)', background: 'transparent', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(181,51,51,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <DeleteOutlined style={{ fontSize: 11 }} />
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {myCourses.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center" style={{ color: 'var(--stone-gray)' }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>暂无课程</div>
            <div style={{ fontSize: 12 }}>点击右上角「新建课程」开始创建</div>
          </div>
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      <AppModal
        open={showModal}
        onCancel={() => setShowModal(false)}
        width={448}
        title={
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, color: 'var(--near-black)' }}>
            {editingCourse ? '编辑课程' : '新建课程'}
          </span>
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowModal(false)}
              style={{ fontSize: 13, borderColor: 'var(--border-cream)', color: 'var(--olive-gray)' }}>
              取消
            </Button>
            <Button type="primary" onClick={handleSubmit}
              style={{ fontSize: 13, background: 'var(--accent)', borderColor: 'var(--accent)' }}>
              {editingCourse ? '保存修改' : '创建课程'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--olive-gray)' }}>
              课程名称
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="输入课程名称"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{
                borderColor: 'var(--border-warm)',
                background: 'var(--parchment)',
                color: 'var(--near-black)',
                fontFamily: 'var(--font-sans)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--focus-blue)';
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(56,152,236,0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-warm)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--olive-gray)' }}>
              课程描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="输入课程描述"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{
                borderColor: 'var(--border-warm)',
                background: 'var(--parchment)',
                color: 'var(--near-black)',
                fontFamily: 'var(--font-sans)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--focus-blue)';
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(56,152,236,0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-warm)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--olive-gray)' }}>
              学科分类
            </label>
            <select
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{
                borderColor: 'var(--border-warm)',
                background: 'var(--parchment)',
                color: 'var(--near-black)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <option value="computer_science">计算机科学</option>
              <option value="mathematics">数学</option>
              <option value="physics">物理</option>
              <option value="language">语言</option>
              <option value="other">其他</option>
            </select>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
