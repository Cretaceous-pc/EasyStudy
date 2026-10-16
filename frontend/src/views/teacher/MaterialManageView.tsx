import { useState, useEffect } from 'react';
import {
  UploadOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useTeacherStore } from '../../stores';

const typeIconMap: Record<string, React.ReactNode> = {
  standardized_md: <FileTextOutlined style={{ color: '#2e7d32' }} />,
  raw_pdf: <FilePdfOutlined style={{ color: '#d32f2f' }} />,
};

const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed: { label: '已完成', color: '#2e7d32', icon: <CheckCircleOutlined style={{ fontSize: 12 }} /> },
  pending: { label: '处理中', color: '#ed6c02', icon: <ClockCircleOutlined style={{ fontSize: 12 }} /> },
  failed: { label: '失败', color: '#d32f2f', icon: <ClockCircleOutlined style={{ fontSize: 12 }} /> },
};

export default function MaterialManageView() {
  const { courseMaterials, selectedCourseId, addMaterial, removeMaterial, fetchCourseMaterials, uploadMaterial, deleteMaterial, isUploading } = useTeacherStore();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  // 加载资料列表
  useEffect(() => {
    if (selectedCourseId) {
      fetchCourseMaterials(selectedCourseId);
    }
  }, [selectedCourseId, fetchCourseMaterials]);

  const filteredMaterials = selectedCourseId
    ? courseMaterials // 实际应按 course_id 过滤，Mock 简化处理
    : courseMaterials;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const uploadFiles = async (files: File[]) => {
    for (const file of files) {
      setUploadQueue((prev) => [...prev, file.name]);
      try {
        const formData = new FormData();
        formData.append('file', file);
        // TODO: 需要设置正确的 course_id
        formData.append('course_id', String(selectedCourseId ?? 1));
        await uploadMaterial(formData);
      } catch (e) {
        console.error('上传失败:', file.name, e);
      } finally {
        setUploadQueue((prev) => prev.filter((n) => n !== file.name));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    uploadFiles(files);
    e.target.value = '';
  };

  const handleDelete = async (materialId: number) => {
    if (confirm('确定要删除这份资料吗？')) {
      await deleteMaterial(materialId);
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
          资料管理
        </h1>
        <label
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none cursor-pointer text-white text-xs font-medium"
          style={{ background: 'var(--accent)', transition: 'all 0.2s' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
          }}
        >
          <UploadOutlined style={{ fontSize: 12 }} />
          上传资料
          <input type="file" accept=".pdf,.md,.txt" multiple className="hidden" onChange={handleFileInput} />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* 拖拽上传区 */}
        <div
          className="rounded-xl p-8 mb-6 flex flex-col items-center justify-center gap-3 transition-all"
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-warm)'}`,
            background: isDragging ? 'rgba(201,100,66,0.04)' : 'var(--ivory)',
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <InboxOutlined style={{ fontSize: 28, color: isDragging ? 'var(--accent)' : 'var(--stone-gray)' }} />
          <div style={{ fontSize: 13, color: 'var(--olive-gray)' }}>
            {isDragging ? '松开以上传文件' : '拖拽文件到此处上传，或点击上方按钮'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--stone-gray)' }}>
            支持 PDF、Markdown、TXT 格式
          </div>
        </div>

        {/* 上传中提示 */}
        {uploadQueue.length > 0 && (
          <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: 'var(--accent-light)' }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--accent)' }}>
              <ClockCircleOutlined style={{ fontSize: 12 }} />
              正在上传 {uploadQueue.length} 个文件...
            </div>
          </div>
        )}

        {/* 资料列表 */}
        <div className="flex flex-col gap-2">
          {filteredMaterials.map((material) => {
            const status = statusMap[material.processing_status] || statusMap.pending;
            const typeIcon = typeIconMap[material.material_type] || <FileTextOutlined />;
            return (
              <div
                key={material.material_id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{
                  background: 'var(--ivory)',
                  border: '1px solid var(--border-cream)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(42,27,24,0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="text-base">{typeIcon}</div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm" style={{ color: 'var(--near-black)', fontWeight: 500 }}>
                    {material.title}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px]" style={{ color: 'var(--stone-gray)' }}>
                      {material.chapter ? `第${material.chapter}章` : '未分类'}
                    </span>
                    {material.chunk_count && (
                      <span className="text-[11px]" style={{ color: 'var(--stone-gray)' }}>
                        {material.chunk_count} 个知识切片
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]" style={{ color: status.color }}>
                    {status.icon}
                    {status.label}
                  </span>
                  <button
                    onClick={() => handleDelete(material.material_id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md border-none cursor-pointer"
                    style={{ color: 'var(--stone-gray)', background: 'transparent', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--error-crimson)';
                      e.currentTarget.style.background = 'rgba(181,51,51,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--stone-gray)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <DeleteOutlined style={{ fontSize: 12 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredMaterials.length === 0 && (
          <div className="h-48 flex flex-col items-center justify-center" style={{ color: 'var(--stone-gray)' }}>
            <FileTextOutlined style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }} />
            <div style={{ fontSize: 13 }}>暂无资料</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>拖拽文件或点击上传按钮添加资料</div>
          </div>
        )}
      </div>
    </div>
  );
}
