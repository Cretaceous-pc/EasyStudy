package com.easystudy.repository;

import com.easystudy.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    Page<User> findByUsernameContainingOrDisplayNameContaining(
            String usernameKeyword, String displayNameKeyword, Pageable pageable);

    /**
     * 按角色筛选用户（在数据库层过滤）。
     *
     * 原实现在内存里对"当前这一页"过滤，却返回未过滤的 total，
     * 导致既拿不到完整的角色列表、分页统计也不正确。
     *
     * @param role    角色名，如 ROLE_TEACHER
     * @param keyword 可选的用户名/显示名模糊匹配；传 null 表示不过滤
     */
    @Query("""
            SELECT u FROM User u
            WHERE EXISTS (
                SELECT 1 FROM UserRole ur JOIN Role r ON ur.roleId = r.id
                WHERE ur.userId = u.id AND r.name = :role
            )
            AND (:keyword IS NULL
                 OR LOWER(u.username) LIKE LOWER(CONCAT('%', :keyword, '%'))
                 OR LOWER(u.displayName) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<User> findByRoleAndKeyword(@Param("role") String role,
                                    @Param("keyword") String keyword,
                                    Pageable pageable);
}
