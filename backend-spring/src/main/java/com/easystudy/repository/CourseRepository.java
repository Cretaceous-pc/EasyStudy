package com.easystudy.repository;

import com.easystudy.model.Course;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CourseRepository extends JpaRepository<Course, Long> {

    Page<Course> findByStatus(String status, Pageable pageable);

    @Query("SELECT c FROM Course c WHERE " +
           "(:subject IS NULL OR c.subject = :subject) AND " +
           "(:status IS NULL OR c.status = :status)")
    Page<Course> findByFilters(@Param("subject") String subject,
                               @Param("status") String status,
                               Pageable pageable);

    Page<Course> findByTeacherId(Long teacherId, Pageable pageable);

    @Query("SELECT c FROM Course c WHERE c.teacherId = :teacherId AND c.id = :courseId")
    Optional<Course> findByIdAndTeacherId(@Param("courseId") Long courseId,
                                          @Param("teacherId") Long teacherId);

    @Query("SELECT COUNT(e) FROM CourseEnrollment e WHERE e.courseId = :courseId")
    long countStudentsByCourseId(@Param("courseId") Long courseId);
}
