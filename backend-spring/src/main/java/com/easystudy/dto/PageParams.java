package com.easystudy.dto;

/**
 * 分页参数校验工具。
 *
 * 背景: 控制器的 page/pageSize 直接来自 @RequestParam，此前没有任何上界或
 * 下界校验。`page=0` 会让 PageRequest.of(-1, ...) 抛 IllegalArgumentException
 * 并返回 500；`pageSize=100000000` 则会让 Hibernate 一次性物化上亿行。
 * 控制器是 permissive 的（部分接口对匿名开放），所以必须在服务端钳制。
 */
public final class PageParams {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 100;

    private PageParams() {
    }

    /** 页码从 1 开始，非法值回落到 1 */
    public static int page(int page) {
        return page < 1 ? 1 : page;
    }

    /** 每页条数钳制到 [1, MAX_PAGE_SIZE] */
    public static int pageSize(int pageSize) {
        if (pageSize < 1) return DEFAULT_PAGE_SIZE;
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }
}
