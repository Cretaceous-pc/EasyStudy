package com.easystudy.repository;

import com.easystudy.model.CourseMaterial;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CourseMaterialRepository extends JpaRepository<CourseMaterial, Long> {

    List<CourseMaterial> findByCourseIdOrderByChapterAscSectionAsc(Long courseId);

    @Query("SELECT m FROM CourseMaterial m WHERE " +
           "m.courseId = :courseId AND " +
           "(:materialType IS NULL OR m.materialType = :materialType) AND " +
           "(:chapter IS NULL OR m.chapter = :chapter)")
    List<CourseMaterial> findByFilters(@Param("courseId") Long courseId,
                                       @Param("materialType") String materialType,
                                       @Param("chapter") String chapter);
}
