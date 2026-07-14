package com.easystudy.dto;

import lombok.Data;
import jakarta.validation.constraints.Size;

@Data
public class CourseUpdateRequest {

    @Size(max = 200, message = "课程标题不能超过200字符")
    private String title;

    @Size(max = 5000, message = "课程描述不能超过5000字符")
    private String description;

    @Size(max = 100, message = "学科不能超过100字符")
    private String subject;

    private String status;
}
