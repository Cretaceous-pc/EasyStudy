package com.easystudy.service;

import com.easystudy.dto.*;
import com.easystudy.exception.BusinessException;
import com.easystudy.model.Course;
import com.easystudy.model.CourseEnrollment;
import com.easystudy.model.User;
import com.easystudy.repository.CourseEnrollmentRepository;
import com.easystudy.repository.CourseRepository;
import com.easystudy.repository.UserRepository;
import com.easystudy.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CourseService {

    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    @Transactional
    public CourseDto createCourse(Long teacherId, CourseCreateRequest request) {
        Course course = Course.builder()
                .teacherId(teacherId)
                .title(request.getTitle())
                .description(request.getDescription())
                .subject(request.getSubject())
                .status("draft")
                .build();

        course = courseRepository.save(course);
        log.info("Course created: id={}, teacherId={}, title={}", course.getId(), teacherId, course.getTitle());

        return toCourseDto(course);
    }

    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<CourseDto>> listCourses(String subject, String status,
                                                            int page, int pageSize) {
        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Course> courses = courseRepository.findByFilters(subject, status, pageable);

        Page<CourseDto> dtoPage = courses.map(this::toCourseDto);
        return ApiResponse.ok(PageResponse.of(dtoPage));
    }

    @Transactional(readOnly = true)
    public CourseDto getCourseDetail(Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> BusinessException.notFound("课程"));
        return toCourseDto(course);
    }

    @Transactional
    public CourseDto updateCourse(Long courseId, Long teacherId, CourseUpdateRequest request) {
        Course course = courseRepository.findByIdAndTeacherId(courseId, teacherId)
                .orElseThrow(() -> BusinessException.notFound("课程"));

        if (request.getTitle() != null) course.setTitle(request.getTitle());
        if (request.getDescription() != null) course.setDescription(request.getDescription());
        if (request.getSubject() != null) course.setSubject(request.getSubject());
        if (request.getStatus() != null) {
            if (!List.of("draft", "published", "archived").contains(request.getStatus())) {
                throw new BusinessException(40001, "无效的课程状态", HttpStatus.BAD_REQUEST);
            }
            course.setStatus(request.getStatus());
        }

        course = courseRepository.save(course);
        log.info("Course updated: id={}", courseId);
        return toCourseDto(course);
    }

    @Transactional
    public ApiResponse<Void> enrollCourse(Long courseId, Long studentId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> BusinessException.notFound("课程"));

        if (!"published".equals(course.getStatus())) {
            throw new BusinessException(40401, "课程不存在或未发布", HttpStatus.NOT_FOUND);
        }

        if (enrollmentRepository.existsByCourseIdAndStudentId(courseId, studentId)) {
            throw BusinessException.conflict(40901, "已选该课程");
        }

        CourseEnrollment enrollment = CourseEnrollment.builder()
                .courseId(courseId)
                .studentId(studentId)
                .build();
        enrollmentRepository.save(enrollment);

        log.info("Student enrolled: courseId={}, studentId={}", courseId, studentId);
        return ApiResponse.ok("选课成功", null);
    }

    @Transactional
    public ApiResponse<Void> unenrollCourse(Long courseId, Long studentId) {
        CourseEnrollment enrollment = enrollmentRepository.findByCourseIdAndStudentId(courseId, studentId)
                .orElseThrow(() -> BusinessException.notFound("选课记录"));

        enrollmentRepository.delete(enrollment);
        log.info("Student unenrolled: courseId={}, studentId={}", courseId, studentId);
        return ApiResponse.ok("退课成功", null);
    }

    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<EnrollmentDto>> listCourseStudents(Long courseId, int page, int pageSize) {
        courseRepository.findById(courseId)
                .orElseThrow(() -> BusinessException.notFound("课程"));

        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "enrolledAt"));
        Page<CourseEnrollment> enrollments = enrollmentRepository.findByCourseId(courseId, pageable);

        Page<EnrollmentDto> dtoPage = enrollments.map(e -> {
            User student = userRepository.findById(e.getStudentId()).orElse(null);
            return EnrollmentDto.builder()
                    .userId(e.getStudentId())
                    .displayName(student != null ? student.getDisplayName() : "未知")
                    .enrolledAt(e.getEnrolledAt())
                    .build();
        });

        return ApiResponse.ok(PageResponse.of(dtoPage));
    }

    @Transactional(readOnly = true)
    public List<CourseDto> getEnrolledCourses(Long studentId) {
        List<CourseEnrollment> enrollments = enrollmentRepository.findByStudentIdAndStatus(
                studentId, "active");

        return enrollments.stream()
                .map(e -> {
                    Course course = courseRepository.findById(e.getCourseId())
                            .orElse(null);
                    if (course == null) return null;
                    CourseDto dto = toCourseDto(course);
                    // 附加选课时间
                    dto.setCreatedAt(e.getEnrolledAt());
                    return dto;
                })
                .filter(dto -> dto != null)
                .toList();
    }

    private CourseDto toCourseDto(Course course) {
        long studentCount = enrollmentRepository.countByCourseId(course.getId());

        String teacherName = null;
        User teacher = userRepository.findById(course.getTeacherId()).orElse(null);
        if (teacher != null) {
            teacherName = teacher.getDisplayName();
        }

        return CourseDto.builder()
                .courseId(course.getId())
                .title(course.getTitle())
                .description(course.getDescription())
                .subject(course.getSubject())
                .coverUrl(course.getCoverUrl())
                .teacherName(teacherName)
                .status(course.getStatus())
                .studentCount(studentCount)
                .createdAt(course.getCreatedAt())
                .updatedAt(course.getUpdatedAt())
                .build();
    }
}
