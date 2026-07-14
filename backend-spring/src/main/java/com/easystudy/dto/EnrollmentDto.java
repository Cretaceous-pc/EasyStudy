package com.easystudy.dto;

import lombok.Builder;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@Builder
public class EnrollmentDto {

    private Long userId;
    private String displayName;
    private OffsetDateTime enrolledAt;
}
