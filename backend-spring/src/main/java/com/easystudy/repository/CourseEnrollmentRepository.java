package com.easystudy.repository;

import com.easystudy.model.CourseEnrollment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseEnrollmentRepository extends JpaRepository<CourseEnrollment, Long> {

    boolean existsByCourseIdAndStudentId(Long courseId, Long studentId);

    Optional<CourseEnrollment> findByCourseIdAndStudentId(Long courseId, Long studentId);

    Page<CourseEnrollment> findByCourseId(Long courseId, Pageable pageable);

    Page<CourseEnrollment> findByStudentId(Long studentId, Pageable pageable);

    long countByCourseId(Long courseId);

    List<CourseEnrollment> findByStudentIdAndStatus(Long studentId, String status);
}
