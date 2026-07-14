package com.easystudy.dto;

import lombok.Builder;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@Builder
public class CourseDto {

    private Long courseId;
    private String title;
    private String description;
    private String subject;
    private String coverUrl;
    private String teacherName;
    private String status;
    private Long studentCount;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
