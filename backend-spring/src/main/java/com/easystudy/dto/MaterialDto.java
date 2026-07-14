package com.easystudy.dto;

import lombok.Builder;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@Builder
public class MaterialDto {

    private Long materialId;
    private Long courseId;
    private String title;
    private String materialType;
    private String fileUrl;
    private String chapter;
    private String section;
    private String processingStatus;
    private Integer chunkCount;
    private Long fileSize;
    private OffsetDateTime createdAt;
}
