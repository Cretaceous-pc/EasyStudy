package com.easystudy.service;

import com.easystudy.dto.ApiResponse;
import com.easystudy.dto.MaterialContentDto;
import com.easystudy.dto.MaterialDto;
import com.easystudy.exception.BusinessException;
import com.easystudy.model.CourseMaterial;
import com.easystudy.repository.CourseEnrollmentRepository;
import com.easystudy.repository.CourseMaterialRepository;
import com.easystudy.repository.CourseRepository;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MaterialService {

    private final CourseMaterialRepository materialRepository;
    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final MinioClient minioClient;

    private static final String BUCKET_NAME = "materials";
    private static final List<String> ALLOWED_EXTENSIONS = List.of("pdf", "md", "txt");
    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    /** 与 DDL 的 SMALLINT 级别字段保持一致（course_materials.chapter/section 为 VARCHAR(64)） */
    private static final int MAX_KEY_SEGMENT_LENGTH = 64;
    /** 与 DDL 的 course_materials.title VARCHAR(256) 对齐 */
    private static final int MAX_TITLE_LENGTH = 256;
    private static final java.util.regex.Pattern KEY_SEGMENT_PATTERN =
            java.util.regex.Pattern.compile("^[0-9A-Za-z_\\-\\u4e00-\\u9fa5]*$");

    /** 校验会被拼进 MinIO 对象键的字段 */
    private void validateKeySegment(String field, String value) {
        if (value == null || value.isBlank()) return;
        if (value.length() > MAX_KEY_SEGMENT_LENGTH) {
            throw new BusinessException(40001, field + " 长度不能超过 " + MAX_KEY_SEGMENT_LENGTH + " 字符",
                    HttpStatus.BAD_REQUEST);
        }
        if (!KEY_SEGMENT_PATTERN.matcher(value).matches()) {
            throw new BusinessException(40001, field + " 只能包含字母、数字、下划线、连字符或中文",
                    HttpStatus.BAD_REQUEST);
        }
    }

    @Transactional
    public MaterialDto uploadMaterial(Long courseId, MultipartFile file, String title,
                                       String chapter, String section, Long uploaderId) {
        // 必须是该课程的教师（或管理员）才能上传。
        // 原实现只校验课程存在，任何教师都能往别人的课程投放内容
        // （删除操作反而有归属校验，两者不一致）。
        courseRepository.findByIdAndTeacherId(courseId, uploaderId)
                .orElseThrow(() -> new BusinessException(40102,
                        "只能向自己负责的课程上传资料", HttpStatus.FORBIDDEN));

        // 验证文件
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new BusinessException(40001, "文件名不能为空", HttpStatus.BAD_REQUEST);
        }

        String extension = getFileExtension(originalFilename).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException(40001, "仅支持 PDF、MD、TXT 格式文件", HttpStatus.BAD_REQUEST);
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException(40001, "文件大小不能超过 20MB", HttpStatus.BAD_REQUEST);
        }

        // chapter/section 会被拼进 MinIO 对象键，且列宽在 DDL 中是 VARCHAR(64)。
        // 必须在此校验：既避免超长导致 DB 报错回滚后留下孤儿对象，
        // 也避免路径分隔符让对象逃出 course-N/ 命名空间。
        validateKeySegment("chapter", chapter);
        validateKeySegment("section", section);
        if (title != null && title.length() > MAX_TITLE_LENGTH) {
            throw new BusinessException(40001, "标题长度不能超过 " + MAX_TITLE_LENGTH + " 字符", HttpStatus.BAD_REQUEST);
        }

        // 生成 MinIO 对象路径
        String objectKey = String.format("course-%d/%s-%s", courseId,
                chapter != null ? "ch" + chapter : "misc",
                UUID.randomUUID().toString().substring(0, 8) + "." + extension);

        // 上传到 MinIO
        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(BUCKET_NAME)
                            .object(objectKey)
                            .stream(file.getInputStream(), file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );
        } catch (Exception e) {
            log.error("Failed to upload file to MinIO: {}", e.getMessage(), e);
            throw new BusinessException(50001, "文件上传失败", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // 保存数据库记录
        String materialType = switch (extension) {
            case "pdf" -> "raw_pdf";
            case "md" -> "standardized_md";
            default -> "raw_text";
        };

        String displayTitle = (title != null && !title.isBlank()) ? title : originalFilename;

        CourseMaterial material = CourseMaterial.builder()
                .courseId(courseId)
                .title(displayTitle)
                .materialType(materialType)
                .fileUrl(objectKey)
                .chapter(chapter)
                .section(section)
                .processingStatus("pending")
                .fileSize(file.getSize())
                .uploadedBy(uploaderId)
                .build();

        material = materialRepository.save(material);
        log.info("Material uploaded: id={}, courseId={}, title={}", material.getId(), courseId, displayTitle);

        return toMaterialDto(material);
    }

    @Transactional(readOnly = true)
    public List<MaterialDto> listMaterials(Long courseId, String materialType, String chapter, Long userId) {
        courseRepository.findById(courseId)
                .orElseThrow(() -> BusinessException.notFound("课程"));

        // 资料列表会返回 MinIO 对象键（fileUrl），因此必须限定为
        // "已选课的学生" 或 "该课程的教师"，否则任何登录用户都能遍历
        // 全部课程的资料清单，进而配合文件代理下载他人课程资料。
        if (!canAccessCourse(courseId, userId)) {
            throw new BusinessException(40102, "无权访问：未选修该课程", HttpStatus.FORBIDDEN);
        }

        List<CourseMaterial> materials = materialRepository.findByFilters(courseId, materialType, chapter);
        return materials.stream().map(this::toMaterialDto).collect(Collectors.toList());
    }

    /**
     * 课程访问权限：学生需已选课，教师需为课程负责人。
     * 供资料列表 / 文件代理 / 内容读取共用。
     */
    @Transactional(readOnly = true)
    public boolean canAccessCourse(Long courseId, Long userId) {
        if (enrollmentRepository.existsByCourseIdAndStudentId(courseId, userId)) {
            return true;
        }
        return courseRepository.findByIdAndTeacherId(courseId, userId).isPresent();
    }

    @Transactional(readOnly = true)
    public MaterialContentDto getMaterialContent(Long materialId, Long userId) {
        CourseMaterial material = materialRepository.findById(materialId)
                .orElseThrow(() -> BusinessException.notFound("资料"));

        // P0-7: 选课权限验证 — 必须选了该课才能读取资料内容
        Long courseId = material.getCourseId();
        boolean isEnrolled = enrollmentRepository.existsByCourseIdAndStudentId(courseId, userId);
        if (!isEnrolled) {
            throw new BusinessException(40102, "无权访问：未选修该课程", HttpStatus.FORBIDDEN);
        }

        // P0-6: PDF 返回二进制 Base64，文本类正常读取
        String materialType = material.getMaterialType();
        boolean isPdf = "raw_pdf".equals(materialType);

        String content = null;
        String contentBase64 = null;

        try (InputStream stream = minioClient.getObject(
                GetObjectArgs.builder()
                        .bucket(BUCKET_NAME)
                        .object(material.getFileUrl())
                        .build()
        )) {
            byte[] bytes = stream.readAllBytes();
            if (isPdf) {
                // PDF 二进制 → Base64 编码，前端用 <embed> 或 PDF.js 渲染
                contentBase64 = Base64.getEncoder().encodeToString(bytes);
                content = null; // PDF 不提供文本内容
            } else {
                // MD / TXT 正常 UTF-8 解码
                content = new String(bytes, StandardCharsets.UTF_8);
                contentBase64 = null;
            }
        } catch (Exception e) {
            log.error("Failed to read material content from MinIO: {}", e.getMessage(), e);
            throw new BusinessException(50001, "读取资料内容失败", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return MaterialContentDto.builder()
                .materialId(material.getId())
                .title(material.getTitle())
                .content(content)
                .contentBase64(contentBase64)
                .materialType(materialType)
                .fileUrl(material.getFileUrl())
                .build();
    }

    @Transactional
    public ApiResponse<Void> deleteMaterial(Long materialId, Long teacherId) {
        CourseMaterial material = materialRepository.findById(materialId)
                .orElseThrow(() -> BusinessException.notFound("资料"));

        // 验证是课程的上传者才能删除
        courseRepository.findByIdAndTeacherId(material.getCourseId(), teacherId)
                .orElseThrow(() -> new BusinessException(40102, "只能删除自己课程的资料", HttpStatus.FORBIDDEN));

        // 删除 MinIO 文件
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(BUCKET_NAME)
                            .object(material.getFileUrl())
                            .build()
            );
        } catch (Exception e) {
            log.warn("Failed to delete file from MinIO: {}", e.getMessage());
            // 继续删除数据库记录，即使 MinIO 删除失败
        }

        materialRepository.delete(material);
        log.info("Material deleted: id={}, courseId={}", materialId, material.getCourseId());

        return ApiResponse.ok("删除成功", null);
    }

    private MaterialDto toMaterialDto(CourseMaterial material) {
        return MaterialDto.builder()
                .materialId(material.getId())
                .courseId(material.getCourseId())
                .title(material.getTitle())
                .materialType(material.getMaterialType())
                .fileUrl(material.getFileUrl())
                .chapter(material.getChapter())
                .section(material.getSection())
                .processingStatus(material.getProcessingStatus())
                .chunkCount(material.getChunkCount())
                .fileSize(material.getFileSize())
                .createdAt(material.getCreatedAt())
                .build();
    }

    private String getFileExtension(String filename) {
        int lastDot = filename.lastIndexOf('.');
        return lastDot >= 0 ? filename.substring(lastDot + 1) : "";
    }
}
