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
        // pageSize=0 时 (double) total / 0 = Infinity，(int) Math.ceil 会抛异常；
        // 这里做兜底，避免分页参数异常导致 500。
        int safePageSize = pageSize > 0 ? pageSize : 1;
        return PageResponse.<T>builder()
                .items(items)
                .total(total)
                .page(page)
                .pageSize(safePageSize)
                .totalPages((int) Math.ceil((double) total / safePageSize))
                .build();
    }
}
