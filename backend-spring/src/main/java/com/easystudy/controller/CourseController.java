package com.easystudy.controller;

import com.easystudy.dto.*;
import com.easystudy.service.CourseService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<CourseDto>> createCourse(
            @Valid @RequestBody CourseCreateRequest request,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        CourseDto course = courseService.createCourse(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("创建成功", course));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<CourseDto>>> listCourses(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) String status) {
        ApiResponse<PageResponse<CourseDto>> response = courseService.listCourses(subject, status, page, pageSize);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{courseId}")
    public ResponseEntity<ApiResponse<CourseDto>> getCourseDetail(@PathVariable Long courseId) {
        CourseDto course = courseService.getCourseDetail(courseId);
        return ResponseEntity.ok(ApiResponse.ok(course));
    }

    @PutMapping("/{courseId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<CourseDto>> updateCourse(
            @PathVariable Long courseId,
            @Valid @RequestBody CourseUpdateRequest request,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        CourseDto course = courseService.updateCourse(courseId, userId, request);
        return ResponseEntity.ok(ApiResponse.ok(course));
    }

    @PostMapping("/{courseId}/enroll")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Void>> enrollCourse(
            @PathVariable Long courseId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        ApiResponse<Void> response = courseService.enrollCourse(courseId, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{courseId}/enroll")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Void>> unenrollCourse(
            @PathVariable Long courseId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        ApiResponse<Void> response = courseService.unenrollCourse(courseId, userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/enrolled")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<CourseDto>>> getEnrolledCourses(
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        List<CourseDto> courses = courseService.getEnrolledCourses(userId);
        return ResponseEntity.ok(ApiResponse.ok(courses));
    }

    @GetMapping("/{courseId}/students")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<PageResponse<EnrollmentDto>>> listCourseStudents(
            @PathVariable Long courseId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int pageSize) {
        ApiResponse<PageResponse<EnrollmentDto>> response = courseService.listCourseStudents(courseId, page, pageSize);
        return ResponseEntity.ok(response);
    }
}
