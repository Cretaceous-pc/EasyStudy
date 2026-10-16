import { useState, useEffect, useRef, useMemo } from 'react';
import { LeftOutlined, FileTextOutlined, FolderOutlined, FolderOpenOutlined, DownOutlined, RightOutlined, LoadingOutlined, MessageOutlined, PlusOutlined, DeleteOutlined, BookOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { useLayoutStore, useCourseStore, useChatStore } from '../../stores';
import * as materialService from '../../services/materialService';
import type { Material } from '../../types/material';
import DeleteConfirmModal from './DeleteConfirmModal';
import CourseSelectModal from './CourseSelectModal';
import gsap from 'gsap';

interface MaterialNode {
  key: string;
  title: string;
  materialId?: number;
  children?: MaterialNode[];
  isLeaf?: boolean;
}

interface DirectoryBarProps {
  visible: boolean;
}

export default function DirectoryBar({ visible }: DirectoryBarProps) {
  const { setCurrentFile, setShowDirectory } = useLayoutStore();
  const { enrolledCourses, activeCourseId, switchToCourse } = useCourseStore();
  const { conversations, currentConversationId, switchConversation, fetchConversations, deleteConversation } = useChatStore();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [activeKey, setActiveKey] = useState<string>('');
  const [treeData, setTreeData] = useState<MaterialNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // 打开删除确认弹窗
  const handleOpenDelete = (convId: number) => {
    setDeletingId(convId);
    setDeleteModalOpen(true);
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (deletingId == null) return;
    try {
      await deleteConversation(deletingId);
      messageApi.success('会话已删除');
    } catch (e) {
      messageApi.error((e as Error).message || '删除失败，请稍后重试');
    } finally {
      setDeleteModalOpen(false);
      setDeletingId(null);
    }
  };

  // 取消删除
  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
    setDeletingId(null);
  };

  // 添加课程确认
  const handleCourseConfirm = async (cid: number) => {
    try {
      await useCourseStore.getState().enrollCourse(cid);
      messageApi.success('已添加课程');
    } catch {
      messageApi.error('添加失败，请稍后重试');
    } finally {
      setCourseModalOpen(false);
    }
  };
  const asideRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  const courseId = activeCourseId || enrolledCourses[0]?.course_id;
  const current = enrolledCourses.find((c) => c.course_id === courseId);
  const courseTitle = current?.title || '课程';

  // 加载课件列表
  useEffect(() => {
    if (!courseId) return;
    setTreeData([]);
    setActiveKey('');
    setLoading(true);
    materialService.getMaterialList({ course_id: courseId })
      .then((materials) => {
        setTreeData(buildMaterialTree(materials));
        setExpandedKeys(new Set(buildMaterialTree(materials).filter((n) => n.children?.length).map((n) => n.key)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // 同时拉取当前课程对话
    fetchConversations({ course_id: courseId });
  }, [courseId, fetchConversations]);

  // 当前课程的对话
  const courseConversations = useMemo(
    () => conversations.filter((c) => c.course_id === courseId),
    [conversations, courseId]
  );


  // GSAP: 侧边栏滑入/滑出
  useEffect(() => {
    if (!asideRef.current) return;
    if (visible) {
      gsap.to(asideRef.current, { width: 260, duration: 0.35, ease: 'power3.out' });
      if (contentRef.current) {
        gsap.fromTo(contentRef.current, { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.3, delay: 0.1, ease: 'power2.out' });
      }
    } else {
      gsap.to(asideRef.current, { width: 0, duration: 0.25, ease: 'power2.in' });
    }
  }, [visible]);

  // 切换课程
  const handleTabClick = (cid: number) => {
    if (cid !== courseId) {
      switchToCourse(cid);
    }
  };

  const toggleExpand = (key: string) => {
    const next = new Set(expandedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedKeys(next);
  };

  const handleSelectFile = (node: MaterialNode) => {
    if (!node.isLeaf || !node.materialId) { toggleExpand(node.key); return; }
    setActiveKey(node.key);
    setCurrentFile({
      id: node.materialId, title: node.title,
      chapter: node.title.split(' ')[0] || '', section: '',
      fileType: 'md', fileUrl: '', courseId: courseId!, courseTitle,
    });
    setShowDirectory(false);
  };

  const renderNode = (node: MaterialNode, depth = 0) => {
    const isExpanded = expandedKeys.has(node.key);
    const isActive = activeKey === node.key;
    const hasChildren = !!node.children?.length;

    return (
      <div key={node.key}>
        <div onClick={() => handleSelectFile(node)}
          className="flex items-center gap-2 rounded-md cursor-pointer select-none"
          style={{ padding: '5px 8px', paddingLeft: `${8 + depth * 12}px`, fontSize: 12.5, color: isActive ? 'var(--near-black)' : hasChildren ? 'var(--charcoal-warm)' : 'var(--olive-gray)', fontWeight: isActive ? 500 : hasChildren ? 500 : 400, fontFamily: 'var(--font-sans)', background: isActive ? 'var(--parchment)' : 'transparent', boxShadow: isActive ? '0 1px 3px rgba(42,27,24,0.04), 0 0 0 1px var(--border-cream)' : 'none', transition: 'background 0.15s, color 0.15s' }}
          onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--warm-sand)'; e.currentTarget.style.color = 'var(--near-black)'; } }}
          onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = hasChildren ? 'var(--charcoal-warm)' : 'var(--olive-gray)'; } }}>
          {hasChildren ? <span style={{ fontSize: 9, color: 'var(--stone-gray)', width: 10, textAlign: 'center' }}>{isExpanded ? <DownOutlined /> : <RightOutlined />}</span> : <span style={{ width: 10 }} />}
          {hasChildren ? (isExpanded ? <FolderOpenOutlined style={{ fontSize: 12, color: '#d4a853' }} /> : <FolderOutlined style={{ fontSize: 12, color: '#d4a853' }} />) : <FileTextOutlined style={{ fontSize: 12, color: 'var(--stone-gray)' }} />}
          <span className="flex-1 truncate">{node.title}</span>
        </div>
        {hasChildren && isExpanded && <div>{node.children!.map((child) => renderNode(child, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <aside ref={asideRef}
      className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        width: visible ? 260 : 0,
        background: 'var(--ivory)',
        borderRight: visible ? '1px solid var(--border-cream)' : 'none',
        boxShadow: visible ? '1px 0 4px rgba(42,27,24,0.02)' : 'none',
      }}
    >
      <style>{`.tab-scroll::-webkit-scrollbar{width:4px;height:4px}.tab-scroll::-webkit-scrollbar-thumb{background:transparent;border-radius:2px}.tab-scroll.show-thumb::-webkit-scrollbar-thumb{background:var(--border-warm)}`}</style>
      {/* 顶部：课程标签 + 关闭按钮 */}
      <div className="flex-shrink-0 overflow-hidden"
        style={{ borderBottom: '1px solid var(--border-cream)' }}>
        {/* 标题行 */}
        <div className="flex items-center justify-between"
          style={{ padding: '14px 16px 8px' }}>
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--stone-gray)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--font-sans)' }}>
            课件资源目录
          </span>
          <LeftOutlined className="cursor-pointer" style={{ fontSize: 10, color: 'var(--stone-gray)' }}
            onClick={() => setShowDirectory(false)} />
        </div>

        {/* 课程标签栏 — 始终显示当前课程 */}
        <div ref={tabScrollRef}
          className="flex gap-1 overflow-x-auto tab-scroll"
          style={{ padding: '0 12px 8px' }}
          onMouseEnter={(e) => e.currentTarget.classList.add('show-thumb')}
          onMouseLeave={(e) => e.currentTarget.classList.remove('show-thumb')}>
          {enrolledCourses.length <= 1 ? (
            <span style={{ padding: '4px 0', fontSize: 11, fontWeight: 500, color: 'var(--near-black)', fontFamily: 'var(--font-sans)' }}>
              📚 {courseTitle}
            </span>
          ) : (
            enrolledCourses.map((c) => {
              const isActive = c.course_id === courseId;
              return (
                <button key={c.course_id} onClick={() => handleTabClick(c.course_id)}
                  className="flex-shrink-0 border-none cursor-pointer rounded-md truncate"
                  style={{ maxWidth: 160, padding: '4px 10px', fontSize: 11, fontWeight: isActive ? 500 : 400, fontFamily: 'var(--font-sans)', background: isActive ? 'var(--accent-light)' : 'transparent', color: isActive ? 'var(--accent)' : 'var(--stone-gray)', border: isActive ? '1px solid var(--accent)' : '1px solid transparent', transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = 'var(--olive-gray)'; e.currentTarget.style.background = 'var(--warm-sand)'; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = 'var(--stone-gray)'; e.currentTarget.style.background = 'transparent'; } }}>
                  {c.title.length > 12 ? c.title.slice(0,12)+'…' : c.title}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 中部：课件树 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto" style={{ padding: '6px 8px' }}>
        {loading ? (
          <div className="flex items-center justify-center gap-2" style={{ padding: '24px 0', fontSize: 12, color: 'var(--stone-gray)' }}>
            <LoadingOutlined style={{ fontSize: 12 }} />加载课件列表...
          </div>
        ) : treeData.length === 0 ? (
          !courseId ? (
            /* 未选择任何课程 */
            <div className="flex flex-col items-center" style={{ padding: '32px 16px' }}>
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'var(--warm-sand)', color: 'var(--stone-gray)', fontSize: 20 }}
              >
                <BookOutlined />
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--near-black)',
                  fontWeight: 500,
                  margin: 0,
                  marginBottom: 4,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                还未选择课程
              </p>
              <p
                style={{
                  fontSize: 11.5,
                  color: 'var(--stone-gray)',
                  margin: 0,
                  marginBottom: 14,
                  textAlign: 'center',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.6,
                }}
              >
                选择一门课程后，即可查看课件资源
              </p>
              <button
                onClick={() => setCourseModalOpen(true)}
                className="border-none cursor-pointer rounded-lg px-4 py-1.5 text-sm transition-all"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: '0 1px 3px rgba(201,100,66,0.25)',
                }}
              >
                添加课程
              </button>
            </div>
          ) : (
            <div style={{ padding: '24px 12px', fontSize: 12, color: 'var(--stone-gray)', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
              暂无课件资源
            </div>
          )
        ) : (
          treeData.map((node) => renderNode(node))
        )}
      </div>

      <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--border-cream)' }}>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full border-none cursor-pointer"
          style={{
            padding: '10px 16px 6px',
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--stone-gray)',
            background: 'transparent',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <span className="flex items-center gap-1.5">
            <MessageOutlined style={{ fontSize: 10 }} />
            会话记录 ({courseConversations.length})
          </span>
          <span style={{ fontSize: 9 }}>{showHistory ? '▾' : '▸'}</span>
        </button>
        {showHistory && (
          <div className="overflow-y-auto" style={{ maxHeight: 160, padding: '0 12px 8px' }}>
            {courseConversations.length === 0 ? (
              <div style={{
                padding: '12px 4px',
                fontSize: 11,
                color: 'var(--stone-gray)',
                textAlign: 'center',
                fontFamily: 'var(--font-sans)',
              }}>
                暂无对话记录
              </div>
            ) : (
              courseConversations.slice(0, 20).map((c) => (
                <div
                  key={c.conversation_id}
                  onClick={() => {
                    switchConversation(c.conversation_id);
                    useLayoutStore.getState().setChatExpanded(true);
                    setShowDirectory(false);
                  }}
                  className="cursor-pointer rounded-md flex items-center justify-between group"
                  style={{
                    padding: '4px 8px', fontSize: 11, marginBottom: 1,
                    background: currentConversationId === c.conversation_id ? 'var(--accent-light)' : 'transparent',
                    color: currentConversationId === c.conversation_id ? 'var(--accent)' : 'var(--olive-gray)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <span className="truncate" style={{ maxWidth: '70%' }}>
                    {c.title || (c.context_type === 'courseware' ? '📖 课件对话' : '💬 自由对话')}
                  </span>
                  <span className="flex items-center gap-1">
                    <span style={{ fontSize: 9, color: 'var(--stone-gray)' }}>{c.message_count ?? 0}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDelete(c.conversation_id);
                      }}
                      className="border-none cursor-pointer opacity-0 group-hover:opacity-100 flex items-center justify-center rounded"
                      style={{
                        width: 16, height: 16, background: 'transparent',
                        color: 'var(--stone-gray)', fontSize: 9,
                        transition: 'all 0.15s',
                      }}
                      title="删除会话"
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--stone-gray)'; }}
                    >
                      <DeleteOutlined />
                    </button>
                  </span>
                </div>
              ))
            )}
            {/* 新建自由对话 — 始终可见 */}
            <div
              onClick={() => {
                useChatStore.getState().setCurrentConversation(null);
                useChatStore.getState().setMessages([]);
                useLayoutStore.getState().setChatExpanded(true);
                setShowDirectory(false);
              }}
              className="cursor-pointer rounded-md flex items-center gap-1.5"
              style={{
                padding: '4px 8px', fontSize: 11, marginTop: 2,
                color: 'var(--accent)', fontFamily: 'var(--font-sans)',
                background: 'transparent',
              }}
            >
              <PlusOutlined style={{ fontSize: 9 }} />
              新对话
            </div>
          </div>
        )}
      </div>
      {contextHolder}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title={
          (courseConversations.find((c) => c.conversation_id === deletingId)?.title || '此会话')
        }
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
      <CourseSelectModal
        open={courseModalOpen}
        onCancel={() => setCourseModalOpen(false)}
        onConfirm={handleCourseConfirm}
      />
    </aside>
  );
}

function buildMaterialTree(materials: Material[]): MaterialNode[] {
  const chapterMap = new Map<string, { node: MaterialNode; order: number; children: { key: string; title: string; materialId: number; chapter: string; chapterOrder: number }[] }>();
  for (const m of materials) {
    // 跳过 AI 生成的资源（在「我的资源」中查看，不污染课件目录）
    if (m.chapter === 'AI生成') continue;
    const chapter = m.chapter || '未分类';
    const num = parseInt(chapter, 10);
    const chapterKey = `ch-${chapter}`;
    const order = isNaN(num) ? 99999 : num;
    let title: string;
    if (isNaN(num)) title = chapter;
    else if (num === 0) title = '前言';
    else title = `第${chapter}章`;

    if (!chapterMap.has(chapterKey)) chapterMap.set(chapterKey, { node: { key: chapterKey, title, children: [] }, order, children: [] });
    chapterMap.get(chapterKey)!.children.push({ key: `mat-${m.material_id}`, title: m.title, materialId: m.material_id, chapter, chapterOrder: order });
  }

  // 章节数 < 3，或每个章节都只有 1-2 个文件时，直接扁平展示
  const shouldFlatten = chapterMap.size < 3 || Array.from(chapterMap.values()).every((entry) => entry.children.length <= 2);
  if (shouldFlatten) {
    const allFiles: { key: string; title: string; materialId: number; chapter: string; chapterOrder: number }[] = [];
    for (const [, entry] of chapterMap) {
      allFiles.push(...entry.children);
    }
    allFiles.sort((a, b) => a.chapterOrder !== b.chapterOrder ? a.chapterOrder - b.chapterOrder : a.title.localeCompare(b.title, 'zh'));
    return allFiles.map((f) => ({ key: f.key, title: f.title, materialId: f.materialId, isLeaf: true }));
  }

  // 章节数 >= 3，按章节分组
  for (const [, entry] of chapterMap) {
    entry.children.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    entry.node.children = entry.children.map((f) => ({ key: f.key, title: f.title, materialId: f.materialId, isLeaf: true }));
  }
  return Array.from(chapterMap.values()).sort((a, b) => a.order - b.order).map((v) => v.node);
}
