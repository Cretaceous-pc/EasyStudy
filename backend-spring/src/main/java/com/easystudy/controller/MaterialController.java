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
            @RequestParam(value = "chapter", required = false) String chapter) {
        List<MaterialDto> materials = materialService.listMaterials(courseId, materialType, chapter);
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
     * 文件代理 — 将 MinIO 中的图片/CSS/JS 等静态资源代理到 API 路径下
     * GET /api/materials/files/course-7/images/abc.png → MinIO materials/course-7/images/abc.png
     */
    @GetMapping("/files/**")
    public ResponseEntity<InputStreamResource> serveFile(
            @RequestParam(value = "token", required = false) String token,
            Authentication authentication) {

        // 提取 MinIO 对象路径（去掉 /api/materials/files/ 前缀）
        String fullPath = "";
        // 用 request attribute 获取实际路径
        jakarta.servlet.http.HttpServletRequest request = 
            ((org.springframework.web.context.request.ServletRequestAttributes)
             org.springframework.web.context.request.RequestContextHolder.currentRequestAttributes())
            .getRequest();
        fullPath = request.getRequestURI();
        String objectKey = fullPath.substring("/api/materials/files/".length());

        if (objectKey.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        try {
            // 获取对象元数据
            var stat = minioClient.statObject(
                StatObjectArgs.builder().bucket(BUCKET).object(objectKey).build()
            );

            // 读取对象
            InputStream stream = minioClient.getObject(
                GetObjectArgs.builder().bucket(BUCKET).object(objectKey).build()
            );

            // 确定 Content-Type
            String contentType = stat.contentType();
            if (contentType == null || contentType.equals("application/octet-stream")) {
                contentType = guessContentType(objectKey);
            }

            // 设置缓存（图片类资源缓存 1 小时）
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .cacheControl(CacheControl.maxAge(java.time.Duration.ofHours(1)))
                    .body(new InputStreamResource(stream));

        } catch (io.minio.errors.ErrorResponseException e) {
            if (e.errorResponse().code().equals("NoSuchKey")) {
                return ResponseEntity.notFound().build();
            }
            log.error("MinIO file proxy error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            log.error("File proxy error for {}: {}", objectKey, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String guessContentType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js")) return "application/javascript";
        return "application/octet-stream";
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
