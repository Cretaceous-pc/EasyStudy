package com.easystudy.repository;

import com.easystudy.model.UserRole;
import com.easystudy.model.UserRoleId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserRoleRepository extends JpaRepository<UserRole, UserRoleId> {

    @Query("SELECT r.name FROM UserRole ur JOIN Role r ON ur.roleId = r.id WHERE ur.userId = :userId")
    List<String> findRoleNamesByUserId(Long userId);

    List<UserRole> findByUserId(Long userId);
}
