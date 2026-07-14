package com.easystudy.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class PageResponse<T> {

    private List<T> items;
    private long total;
    private int page;
    private int pageSize;
    private int totalPages;

    public static <T> PageResponse<T> of(org.springframework.data.domain.Page<T> pageData) {
        return PageResponse.<T>builder()
                .items(pageData.getContent())
                .total(pageData.getTotalElements())
                .page(pageData.getNumber() + 1)
                .pageSize(pageData.getSize())
                .totalPages(pageData.getTotalPages())
                .build();
    }

    /** 从 List + 总数构造（用于内存过滤场景） */
    public static <T> PageResponse<T> of(List<T> items, long total, int page, int pageSize) {
        return PageResponse.<T>builder()
                .items(items)
                .total(total)
                .page(page)
                .pageSize(pageSize)
                .totalPages((int) Math.ceil((double) total / pageSize))
                .build();
    }
}
