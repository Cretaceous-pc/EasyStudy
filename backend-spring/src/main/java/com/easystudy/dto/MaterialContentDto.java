package com.easystudy.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MaterialContentDto {

    private Long materialId;
    private String title;
    private String content;         // 文本内容（md/txt）
    private String fileUrl;
    private String materialType;    // raw_pdf / standardized_md / raw_text
    private String contentBase64;   // PDF 二进制 Base64（仅 PDF 类型）
}
