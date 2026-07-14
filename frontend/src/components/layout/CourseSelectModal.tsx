import { useState, useEffect } from 'react';
import { useCourseStore } from '../../stores';
import AppModal from '../shared/AppModal';
import { BookOutlined, CheckOutlined } from '@ant-design/icons';
import type { Course } from '../../types/course';

interface CourseSelectModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (courseId: number) => void;
}

export default function CourseSelectModal({ open, onCancel, onConfirm }: CourseSelectModalProps) {
  const { allCourses, fetchAllCourses, enrolledCourses, fetchEnrolledCourses } = useCourseStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      fetchAllCourses();
      fetchEnrolledCourses();
      setSelectedId(null);
    }
  }, [open, fetchAllCourses, fetchEnrolledCourses]);

  // 过滤掉已选课程
  const availableCourses: Course[] = allCourses.filter(
    (c) => !enrolledCourses.some((ec) => ec.course_id === c.course_id)
  );

  const handleConfirm = () => {
    if (selectedId) {
      onConfirm(selectedId);
    }
  };

  return (
    <AppModal
      open={open}
      onCancel={onCancel}
      width={480}
      title={
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 17,
            fontWeight: 500,
            color: 'var(--near-black)',
          }}
        >
          选择课程
        </span>
      }
      styles={{ body: { padding: '16px 24px 20px' } }}
      footer={
        <div className="flex items-center justify-end gap-3" style={{ padding: '12px 24px 16px' }}>
          <button
            onClick={onCancel}
            className="border-none cursor-pointer text-sm rounded-lg px-4 py-2 transition-all"
            style={{
              background: 'var(--parchment)',
              color: 'var(--olive-gray)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="border-none cursor-pointer text-sm rounded-lg px-4 py-2 transition-all flex items-center gap-1.5"
            style={{
              background: selectedId ? 'var(--accent)' : 'var(--stone-gray)',
              color: '#fff',
              fontFamily: 'var(--font-sans)',
              opacity: selectedId ? 1 : 0.5,
              cursor: selectedId ? 'pointer' : 'not-allowed',
              boxShadow: selectedId ? '0 1px 3px rgba(201,100,66,0.25)' : 'none',
            }}
          >
            <CheckOutlined style={{ fontSize: 12 }} />
            确认
          </button>
        </div>
      }
    >
      {availableCourses.length === 0 ? (
        <div
          style={{
            padding: '32px 0',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--stone-gray)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          暂无可选课程
        </div>
      ) : (
        <div className="flex flex-col gap-2" style={{ maxHeight: 360, overflowY: 'auto' }}>
          {availableCourses.map((course) => {
            const isSelected = selectedId === course.course_id;
            return (
              <button
                key={course.course_id}
                onClick={() => setSelectedId(course.course_id)}
                className="text-left p-4 rounded-xl border-none cursor-pointer transition-all"
                style={{
                  background: isSelected ? 'var(--accent-light)' : 'var(--parchment)',
                  border: isSelected
                    ? '1px solid var(--accent)'
                    : '1px solid var(--border-cream)',
                }}
              >
                <div className="flex items-start gap-3">
                  {/* 图标 */}
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      background: isSelected ? 'var(--accent)' : 'var(--warm-sand)',
                      color: isSelected ? '#fff' : 'var(--stone-gray)',
                      fontSize: 16,
                      transition: 'all 0.2s',
                    }}
                  >
                    <BookOutlined />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--near-black)',
                        marginBottom: 2,
                      }}
                    >
                      {course.title}
                    </div>
                    {course.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--stone-gray)',
                          lineHeight: 1.5,
                          marginBottom: 4,
                        }}
                      >
                        {course.description}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--stone-gray)' }}>
                      {course.teacher_name}
                      {course.subject ? ` · ${course.subject}` : ''}
                      {course.student_count > 0 ? ` · ${course.student_count} 名学员` : ''}
                    </div>
                  </div>
                  {/* 选中指示 */}
                  {isSelected && (
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        background: 'var(--accent)',
                        color: '#fff',
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      <CheckOutlined />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </AppModal>
  );
}
