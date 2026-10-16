package com.easystudy.controller;

import com.easystudy.dto.*;
import com.easystudy.service.MaterialService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.StatObjectArgs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/materials")
@RequiredArgsConstructor
public class MaterialController {

    private final MaterialService materialService;
    private final MinioClient minioClient;
    private static final String BUCKET = "materials";

    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<MaterialDto>> uploadMaterial(
            @RequestParam("file") MultipartFile file,
            @RequestParam("course_id") Long courseId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "chapter", required = false) String chapter,
            @RequestParam(value = "section", required = false) String section,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        MaterialDto material = materialService.uploadMaterial(courseId, file, title, chapter, section, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("上传成功", material));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<MaterialDto>>> listMaterials(
            @RequestParam("course_id") Long courseId,
            @RequestParam(value = "material_type", required = false) String materialType,
            @RequestParam(value = "chapter", required = false) String chapter,
            Authentication authentication) {
        // 必须带调用者身份：原实现只校验课程存在，任何登录用户都能列出
        // 任意课程的资料并拿到其 MinIO 对象键。
        Long userId = (Long) authentication.getPrincipal();
        List<MaterialDto> materials = materialService.listMaterials(courseId, materialType, chapter, userId);
        return ResponseEntity.ok(ApiResponse.ok(materials));
    }

    @GetMapping("/{materialId}/content")
    public ResponseEntity<ApiResponse<MaterialContentDto>> getMaterialContent(
            @PathVariable Long materialId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        MaterialContentDto content = materialService.getMaterialContent(materialId, userId);
        return ResponseEntity.ok(ApiResponse.ok(content));
    }

    /**
     * 文件代理 — 将 MinIO 中的静态资源代理到 API 路径下
     * GET /api/materials/files/course-7/images/abc.png → MinIO materials/course-7/images/abc.png
     *
     * 安全约束（本轮修复）:
     *  1. 不再 permitAll，调用方必须已认证（见 SecurityConfig）
     *  2. 课程归属校验：从对象键解析 course-N 并校验调用者已选课或是课程教师
     *  3. Content-Type 不再原样回显 MinIO 元数据 —— 该元数据来自上传时客户端
     *     自报的 multipart 类型，攻击者可用 .txt + Content-Type: text/html
     *     让本接口在同源下返回可执行的 HTML（存储型 XSS）。
     *     现改为按白名单扩展名推导，并对非内联类型强制 attachment。
     */
    @GetMapping("/files/**")
    public ResponseEntity<InputStreamResource> serveFile(Authentication authentication) {

        jakarta.servlet.http.HttpServletRequest request =
            ((org.springframework.web.context.request.ServletRequestAttributes)
             org.springframework.web.context.request.RequestContextHolder.currentRequestAttributes())
            .getRequest();
        String objectKey = request.getRequestURI().substring("/api/materials/files/".length());

        if (objectKey.isEmpty() || objectKey.contains("..")) {
            return ResponseEntity.notFound().build();
        }

        // 对象键形如 course-<id>/... —— 解析课程号后校验访问权限
        Long userId = (Long) authentication.getPrincipal();
        Long courseId = parseCourseId(objectKey);
        if (courseId == null) {
            log.warn("File proxy: 无法从对象键解析课程号, key={}", objectKey);
            return ResponseEntity.notFound().build();
        }
        if (!materialService.canAccessCourse(courseId, userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        InputStream stream = null;
        try {
            var stat = minioClient.statObject(
                StatObjectArgs.builder().bucket(BUCKET).object(objectKey).build()
            );

            stream = minioClient.getObject(
                GetObjectArgs.builder().bucket(BUCKET).object(objectKey).build()
            );

            // 由扩展名推导类型（白名单），忽略客户端自报的元数据
            MediaType mediaType = safeContentType(objectKey);

            // 非图片/PDF 一律作为附件下载，避免在同源下被当作可执行文档渲染
            boolean inlineSafe = mediaType.getType().equals("image")
                    || MediaType.APPLICATION_PDF.includes(mediaType);

            ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                    .contentType(mediaType)
                    .header("X-Content-Type-Options", "nosniff")
                    .cacheControl(CacheControl.maxAge(java.time.Duration.ofHours(1)));
            if (!inlineSafe) {
                builder.header("Content-Disposition", "attachment");
            }

            InputStream toReturn = stream;
            stream = null; // 所有权移交给响应体，避免 finally 中关闭
            return builder.body(new InputStreamResource(toReturn));

        } catch (io.minio.errors.ErrorResponseException e) {
            if (e.errorResponse().code().equals("NoSuchKey")) {
                return ResponseEntity.notFound().build();
            }
            log.error("MinIO file proxy error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("File proxy error for {}: {}", objectKey, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } finally {
            // 任何在返回响应体之前失败的路径都必须关闭对象流，
            // 否则每次失败都会泄漏一个 MinIO 连接（原实现未做 try-with-resources）。
            if (stream != null) {
                try {
                    stream.close();
                } catch (Exception ignored) {
                    // 关闭失败无需处理
                }
            }
        }
    }

    /** 从对象键 course-<id>/... 解析课程号，失败返回 null */
    private Long parseCourseId(String objectKey) {
        if (!objectKey.startsWith("course-")) return null;
        int slash = objectKey.indexOf('/');
        String numPart = (slash > 0 ? objectKey.substring(7, slash) : objectKey.substring(7));
        try {
            return Long.parseLong(numPart);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 由扩展名推导 Content-Type（白名单）。
     * 未识别的扩展名一律 application/octet-stream，绝不回显客户端自报类型。
     */
    private MediaType safeContentType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return MediaType.IMAGE_JPEG;
        if (lower.endsWith(".gif")) return MediaType.IMAGE_GIF;
        if (lower.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        if (lower.endsWith(".pdf")) return MediaType.APPLICATION_PDF;
        if (lower.endsWith(".md")) return MediaType.parseMediaType("text/markdown; charset=UTF-8");
        if (lower.endsWith(".txt")) return MediaType.parseMediaType("text/plain; charset=UTF-8");
        // 注意: svg 未列入白名单 —— SVG 可内嵌脚本，内联渲染即成为存储型 XSS 载体
        return MediaType.APPLICATION_OCTET_STREAM;
    }

    @DeleteMapping("/{materialId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteMaterial(
            @PathVariable Long materialId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        ApiResponse<Void> response = materialService.deleteMaterial(materialId, userId);
        return ResponseEntity.ok(response);
    }
}
