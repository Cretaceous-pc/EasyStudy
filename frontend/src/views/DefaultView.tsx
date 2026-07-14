import { useState, useEffect, useRef } from 'react';
import { useChatStore, useLayoutStore, useCourseStore, useResourceStore } from '../stores';
import ChatInput from '../components/chat/ChatInput';
import MessageList from '../components/chat/MessageList';
import FastScroller from '../components/chat/FastScroller';
import gsap from 'gsap';
import type { ResourceType } from '../types/resource';
import {
  FileTextOutlined,
  PartitionOutlined,
  EditOutlined,
  CodeOutlined,
  ReadOutlined,
  BookOutlined,
  FolderOpenOutlined,
  CompassOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import AppModal from '../components/shared/AppModal';
import CourseSelectModal from '../components/layout/CourseSelectModal';

const MIN_MSG_FOR_SCROLLER = 6;

export default function DefaultView() {
  const {
    messages, conversations, currentConversationId, streamingContent, isStreaming,
    fetchConversations, switchConversation, setCurrentConversation,
  } = useChatStore();
  const { isChatExpanded, toggleChatExpand, setChatExpanded } = useLayoutStore();
  const { enrolledCourses, allCourses, fetchAllCourses, fetchEnrolledCourses, enrollCourse, unenrollCourse, activeCourseId, switchToCourse } = useCourseStore();
  const { resources, fetchResources } = useResourceStore();
  const [showHistory, setShowHistory] = useState(false);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const greetingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const expandedContentRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const courseId = activeCourseId || enrolledCourses[0]?.course_id;
  const courseIdReady = !!courseId;

  useEffect(() => {
    fetchAllCourses();
    fetchEnrolledCourses().then(() => {
      const first = useCourseStore.getState().enrolledCourses[0];
      if (first && !useCourseStore.getState().activeCourseId) {
        switchToCourse(first.course_id);
      }
    });
  }, [fetchAllCourses, fetchEnrolledCourses, switchToCourse]);

  useEffect(() => {
    if (courseIdReady) {
      fetchConversations({ course_id: courseId });
      fetchResources({ course_id: courseId });
    }
  }, [courseIdReady, courseId, fetchConversations, fetchResources]);

  // GSAP: 展开动画 — 消息区从下方淡入
  useEffect(() => {
    if (isChatExpanded && expandedContentRef.current) {
      gsap.fromTo(expandedContentRef.current,
        { opacity: 0, y: 48 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }
      );
    }
  }, [isChatExpanded]);

  // GSAP: 收起时先淡出再重置（由 conditional rendering 处理卸载）
  const collapsingRef = useRef(false);
  useEffect(() => {
    if (!isChatExpanded && expandedContentRef.current && !collapsingRef.current) {
      collapsingRef.current = true;
      gsap.to(expandedContentRef.current, {
        opacity: 0, y: 24, duration: 0.25, ease: 'power2.in',
        onComplete: () => { collapsingRef.current = false; }
      });
    }
  }, [isChatExpanded]);

  // GSAP: 新消息入场 — 错落淡入
  const prevMsgCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      requestAnimationFrame(() => {
        const bubbles = document.querySelectorAll('.msg-bubble-new');
        if (bubbles.length > 0) {
          gsap.fromTo(bubbles,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: 'power2.out' }
          );
          bubbles.forEach((b) => b.classList.remove('msg-bubble-new'));
        }
      });
    }
    prevMsgCount.current = messages.length;
  }, [messages.length]);

  // GSAP: 切换对话时消息区淡出再淡入
  const prevConvId = useRef(currentConversationId);
  useEffect(() => {
    if (prevConvId.current !== currentConversationId) {
      const msgContainer = document.querySelector('.chat-messages-container');
      if (msgContainer) {
        gsap.fromTo(msgContainer,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, ease: 'power2.out' }
        );
      }
      prevConvId.current = currentConversationId;
    }
  }, [currentConversationId]);

  // GSAP: 首页问候语淡入
  useEffect(() => {
    if (!isChatExpanded && greetingRef.current) {
      gsap.fromTo(greetingRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
      );
    }
  }, [isChatExpanded]);

  // GSAP: 课程卡片错落入场
  useEffect(() => {
    if (enrolledCourses.length > 0 && !isChatExpanded) {
      requestAnimationFrame(() => {
        const cards = document.querySelectorAll('.course-card-item');
        if (cards.length > 0) {
          gsap.fromTo(cards, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' });
        }
      });
    }
  }, [enrolledCourses.length, isChatExpanded]);

  const handleExpand = (e: React.MouseEvent) => {
    if (isChatExpanded) return;
    e.stopPropagation();
    toggleChatExpand();
  };

  const scrollToMsg = (index: number) => {
    const el = document.getElementById(`msg-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      gsap.fromTo(el, { backgroundColor: 'rgba(201,100,66,0.12)' }, { backgroundColor: 'transparent', duration: 1, ease: 'power2.out' });
    }
  };

  return (
    <>
      <style>{`.cards-scroll::-webkit-scrollbar{width:4px;height:4px}.cards-scroll::-webkit-scrollbar-thumb{background:transparent;border-radius:2px}.cards-scroll.show-thumb::-webkit-scrollbar-thumb{background:var(--border-warm)}`}</style>
    <div
      ref={chatAreaRef}
      className="flex flex-col items-center overflow-y-auto"
      style={{
        flex: 1,
        padding: isChatExpanded ? '16px 32px 0' : '0 32px',
        transition: 'padding 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── 收起态：AI对话框居中 + 卡片在下方 ── */}
      {!isChatExpanded && (
        <>
          {/* 对话框区域 */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 w-full"
            style={{ minHeight: '60vh' }}>
            <div ref={greetingRef} className="text-center overflow-hidden" style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 500, color: 'var(--near-black)', marginBottom: 6, letterSpacing: '-0.3px', lineHeight: 1.25 }}>
                今天想学点什么？
              </h2>
              <p style={{ fontSize: 13, color: 'var(--olive-gray)', fontFamily: 'var(--font-sans)' }}>
                选择下方课程或直接向我提问——我会基于课程资料给出精准回答
              </p>
            </div>
            <div ref={inputWrapperRef} onDoubleClick={handleExpand}
              style={{ width: '100%', maxWidth: 580 }}>
              <ChatInput expanded={false} />
            </div>
          </div>

          {/* 卡片区域 — 紧跟对话框下方 */}
          <div ref={cardsRef} className="w-full flex-shrink-0"
            style={{ maxWidth: 720, paddingTop: 24, borderTop: '1px solid var(--border-cream)', paddingBottom: 40 }}>
            <SectionTitle>我的在学课程</SectionTitle>
            {enrolledCourses.length === 0 ? (
              <EmptyStateCard
                icon={<BookOutlined />}
                title="还没有在学课程"
                description="添加一门课程，开始你的个性化学习之旅"
                actionLabel="浏览课程"
                onAction={() => setCourseModalOpen(true)}
              />
            ) : (
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {enrolledCourses.map((course) => (
                <CourseCard key={course.course_id} title={course.title} meta={`${course.teacher_name} · ${course.student_count} 人在学`}
                  active={course.course_id === activeCourseId}
                  onClick={() => { switchToCourse(course.course_id); useLayoutStore.getState().setShowDirectory(true); }}
                  onDelete={() => unenrollCourse(course.course_id)}
                />
              ))}
            </div>
            )}
            <SectionTitle style={{ marginTop: 24 }}>我的资源</SectionTitle>
            {resources.length === 0 ? (
              <EmptyStateCard
                icon={<FolderOpenOutlined />}
                title="暂无学习资源"
                description="前往资源生成，AI 将为你定制个性化学习材料"
                actionLabel="生成资源"
                onAction={() => useLayoutStore.getState().setActiveView('resources')}
              />
            ) : (
              <div
                className="grid grid-cols-5 gap-3 overflow-y-auto pr-1 cards-scroll"
                style={{ maxHeight: 228 }}
                onMouseEnter={(e) => e.currentTarget.classList.add('show-thumb')}
                onMouseLeave={(e) => e.currentTarget.classList.remove('show-thumb')}
              >
                {resources.map((r) => (
                  <ResourceCardSmall key={r.id} resource={r} />
                ))}
              </div>
            )}
            <div id="section-recommend" />
            <SectionTitle style={{ marginTop: 24 }}>为你推荐</SectionTitle>
            {allCourses.filter((c) => !enrolledCourses.find((e) => e.course_id === c.course_id)).length === 0 ? (
              <EmptyStateCard
                icon={<CompassOutlined />}
                title="暂无更多课程"
                description="所有可用课程已全部加入学习，敬请期待更多内容"
              />
            ) : (
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {allCourses.filter((c) => !enrolledCourses.find((e) => e.course_id === c.course_id)).map((course) => (
                <RecCard key={course.course_id} title={course.title} meta={`${course.student_count} 人在学`} description={course.description} onEnroll={() => enrollCourse(course.course_id)} />
              ))}
            </div>
            )}
          </div>
        </>
      )}

      {/* ── 展开态：消息区占满 → 对话框下沉到底部 ── */}
      {isChatExpanded && (
        <div ref={expandedContentRef} className="flex flex-col flex-1 min-h-0" style={{ width: '100%', maxWidth: 680 }}>
          {/* 工具栏 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexShrink: 0 }}>
            {messages.length > 0 && (
              <button
                onClick={() => { setCurrentConversation(null); switchConversation(null); }}
                disabled={isStreaming}
                className="border cursor-pointer rounded-md flex items-center gap-1"
                style={{ fontSize: 10, color: 'var(--accent)', background: 'transparent', borderColor: 'var(--accent-light)', padding: '3px 10px', fontFamily: 'var(--font-sans)', opacity: isStreaming ? 0.4 : 1 }}
              >+ 新对话</button>
            )}
            {conversations.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="border-none cursor-pointer"
                style={{ fontSize: 11, color: 'var(--stone-gray)', background: 'transparent', padding: '4px 0', fontFamily: 'var(--font-sans)' }}
              >{showHistory ? '▾ 隐藏历史对话' : `▸ 历史对话 (${conversations.length})`}</button>
            )}
          </div>

          {/* 对话历史列表 */}
          {showHistory && conversations.length > 0 && (
            <div style={{ marginBottom: 8, flexShrink: 0 }}>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <div onClick={() => { setCurrentConversation(null); switchConversation(null); setShowHistory(false); }} className="cursor-pointer rounded-md"
                  style={{ padding: '5px 10px', fontSize: 12, marginBottom: 4, background: currentConversationId === null ? 'var(--accent-light)' : 'transparent', color: currentConversationId === null ? 'var(--accent)' : 'var(--olive-gray)', fontFamily: 'var(--font-sans)' }}>
                  + 自由对话
                </div>
                {conversations.filter((c) => c.context_type === 'courseware' && c.material_id).map((c) => (
                  <div key={c.conversation_id} onClick={() => { switchConversation(c.conversation_id); setShowHistory(false); }} className="cursor-pointer rounded-md flex justify-between items-center"
                    style={{ padding: '5px 10px', fontSize: 12, marginBottom: 2, background: c.conversation_id === currentConversationId ? 'var(--accent-light)' : 'transparent', color: c.conversation_id === currentConversationId ? 'var(--accent)' : 'var(--olive-gray)', fontFamily: 'var(--font-sans)' }}>
                    <span className="truncate flex items-center gap-1.5" style={{ maxWidth: '78%' }}><span style={{ fontSize: 10, color: 'var(--warm-silver)' }}>📖</span>{c.title || '课件对话'}</span>
                    <span style={{ fontSize: 10, color: 'var(--stone-gray)' }}>{c.message_count ?? 0}</span>
                  </div>
                ))}
                {conversations.filter((c) => c.context_type !== 'courseware' || !c.material_id).map((c) => (
                  <div key={c.conversation_id} onClick={() => { switchConversation(c.conversation_id); setShowHistory(false); }} className="cursor-pointer rounded-md flex justify-between items-center"
                    style={{ padding: '5px 10px', fontSize: 12, marginBottom: 2, background: c.conversation_id === currentConversationId ? 'var(--accent-light)' : 'transparent', color: c.conversation_id === currentConversationId ? 'var(--accent)' : 'var(--olive-gray)', fontFamily: 'var(--font-sans)' }}>
                    <span className="truncate flex items-center gap-1.5" style={{ maxWidth: '78%' }}><span style={{ fontSize: 10, color: 'var(--warm-silver)' }}>💬</span>{c.title || '未命名对话'}</span>
                    <span style={{ fontSize: 10, color: 'var(--stone-gray)' }}>{c.message_count ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 消息列表 — flex-1 撑满剩余空间 */}
          <div className="chat-messages-container flex-1 overflow-y-auto min-h-0" style={{ padding: '4px 4px 12px', scrollbarWidth: 'none' }}>
            <MessageList messages={messages} streamingContent={streamingContent} isStreaming={isStreaming} variant="default" courseId={courseId} />
          </div>
          {messages.length >= MIN_MSG_FOR_SCROLLER && <FastScroller messages={messages} onScrollTo={scrollToMsg} />}

          {/* 对话框 — 固定在底部 */}
          <div ref={inputWrapperRef} style={{ width: '100%', flexShrink: 0, paddingTop: 8 }}>
            <ChatInput expanded={true} />
          </div>
        </div>
      )}
    </div>
      <CourseSelectModal
        open={courseModalOpen}
        onCancel={() => setCourseModalOpen(false)}
        onConfirm={async (cid) => {
          await enrollCourse(cid);
          setCourseModalOpen(false);
        }}
      />
    </>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="mb-3" style={{ fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--stone-gray)', textTransform: 'uppercase', letterSpacing: '0.8px', ...style }}>{children}</div>;
}

function EmptyStateCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center rounded-2xl"
      style={{
        padding: '28px 24px',
        background: 'var(--ivory)',
        border: '1px dashed var(--border-cream)',
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
        style={{
          background: 'var(--warm-sand)',
          color: 'var(--stone-gray)',
          fontSize: 18,
        }}
      >
        {icon}
      </div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--near-black)',
          margin: 0,
          marginBottom: 4,
          fontFamily: 'var(--font-sans)',
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: 12,
          color: 'var(--stone-gray)',
          margin: 0,
          fontFamily: 'var(--font-sans)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="border-none cursor-pointer rounded-lg px-4 py-1.5 text-sm transition-all mt-3"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            fontFamily: 'var(--font-sans)',
            boxShadow: '0 1px 3px rgba(201,100,66,0.25)',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function CourseCard({ title, meta, active, onClick, onDelete }: { title: string; meta: string; active?: boolean; onClick?: () => void; onDelete?: () => void }) {
  return (
    <div onClick={onClick} className="course-card-item rounded-xl p-4 flex-shrink-0 cursor-pointer relative group"
      style={{ minWidth: 195, background: active ? 'var(--accent-light)' : 'var(--ivory)', border: active ? '1px solid var(--accent)' : '1px solid var(--border-cream)', boxShadow: active ? '0 2px 8px rgba(201,100,66,0.1)' : '0 1px 3px rgba(42,27,24,0.03)', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(42,27,24,0.06)'; e.currentTarget.style.borderColor = 'var(--border-warm)'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(42,27,24,0.03)'; e.currentTarget.style.borderColor = 'var(--border-cream)'; } }}>
      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--near-black)', fontFamily: 'var(--font-serif)', marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--olive-gray)' }}>{meta}</div>
      {/* 删除课程 — hover 时右下角浮现 */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 border-none cursor-pointer rounded flex items-center gap-1 px-2 py-1 transition-all"
          style={{
            fontSize: 10,
            color: 'var(--stone-gray)',
            background: 'var(--ivory)',
            fontFamily: 'var(--font-sans)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--stone-gray)'; }}
        >
          <DeleteOutlined style={{ fontSize: 9 }} />
          删除课程
        </button>
      )}
    </div>
  );
}

function RecCard({ title, meta, description, onEnroll }: { title: string; meta: string; description?: string; onEnroll?: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <div className="course-card-item rounded-xl p-4 flex-shrink-0 cursor-pointer flex items-center justify-between"
        style={{ minWidth: 195, background: 'var(--ivory)', border: '1px solid var(--border-cream)', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--parchment)'; e.currentTarget.style.borderColor = 'var(--border-warm)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ivory)'; e.currentTarget.style.borderColor = 'var(--border-cream)'; }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--near-black)', fontFamily: 'var(--font-sans)' }}>{title}</div>
          <div style={{ fontSize: 10, color: 'var(--stone-gray)', fontFamily: 'var(--font-sans)', marginTop: 1 }}>{meta}</div>
        </div>
        <div onClick={() => setShowConfirm(true)} className="w-6.5 h-6.5 rounded flex items-center justify-center cursor-pointer"
          style={{ border: '1px solid var(--border-cream)', background: 'var(--parchment)', color: 'var(--accent)', fontSize: 10, transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--parchment)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--border-cream)'; }}>+</div>
      </div>
      <AppModal
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        width={400}
        title={
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500, color: 'var(--near-black)' }}>
            添加课程
          </span>
        }
        footer={
          <div className="flex justify-end gap-2.5">
            <Button onClick={() => setShowConfirm(false)}
              style={{ fontSize: 13, borderColor: 'var(--border-cream)', color: 'var(--olive-gray)' }}>
              取消
            </Button>
            <Button type="primary" onClick={() => { setShowConfirm(false); onEnroll?.(); }}
              style={{ fontSize: 13, background: 'var(--accent)', borderColor: 'var(--accent)' }}>
              确认
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 13.5, color: 'var(--olive-gray)', lineHeight: 1.7, margin: 0 }}>
          {description || '暂无课程介绍'}
        </p>
      </AppModal>
    </>
  );
}

const typeMiniConfig: Record<ResourceType, { icon: any; label: string; color: string; bg: string }> = {
  document: { icon: FileTextOutlined, label: '知识点', color: '#c96442', bg: '#e8d4c8' },
  mermaid: { icon: PartitionOutlined, label: '思维导图', color: '#5b8c5a', bg: '#d4e4d4' },
  exercise_set: { icon: EditOutlined, label: '练习题', color: '#d4a017', bg: '#f0e6c8' },
  code_case: { icon: CodeOutlined, label: '代码案例', color: '#4a7c9b', bg: '#d0e0ec' },
  reading_material: { icon: ReadOutlined, label: '拓展阅读', color: '#8b6f8b', bg: '#e4d8e4' },
};

function ResourceCardSmall({ resource }: { resource: import('../types/resource').Resource }) {
  const config = typeMiniConfig[resource.resource_type];
  const Icon = config.icon;

  const handleClick = () => {
    let md = '';
    const c = resource.content as Record<string, unknown> | undefined;
    if (typeof c?.markdown === 'string') md = c.markdown;
    else if (typeof c?.text === 'string') md = c.text;
    else if (c) md = JSON.stringify(c, null, 2);

    const { setCurrentFile } = useLayoutStore.getState();
    const { currentCourse } = useCourseStore.getState();
    setCurrentFile({
      id: parseInt(resource.id, 10) || 0,
      title: resource.title,
      chapter: resource.topic || 'AI生成',
      section: '',
      fileType: 'resource',
      fileUrl: '',
      courseId: currentCourse?.course_id ?? 0,
      courseTitle: currentCourse?.title ?? '',
      resourceContent: md,
    });
  };

  return (
    <div onClick={handleClick} className="course-card-item rounded-xl p-3.5 cursor-pointer"
      style={{ background: 'var(--ivory)', border: '1px solid var(--border-cream)', boxShadow: '0 1px 3px rgba(42,27,24,0.03)', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(42,27,24,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(42,27,24,0.03)'; }}>
      <div className="w-7 h-7 rounded-md flex items-center justify-center mb-2" style={{ background: config.bg, color: config.color }}>
        <Icon style={{ fontSize: 13 }} />
      </div>
      <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--near-black)', fontFamily: 'var(--font-sans)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resource.title}</div>
      <span className="inline-block rounded px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, background: config.bg, color: config.color }}>{config.label}</span>
    </div>
  );
}
