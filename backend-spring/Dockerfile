# ═══════════════════════════════════════════════════
# easyStudy — Spring Boot 后端 Dockerfile
# 多阶段构建: Maven 编译 → JRE 运行
# ═══════════════════════════════════════════════════

# ── 阶段 1: 编译 ──
FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /build

# Maven 阿里云镜像加速（国内构建）
COPY settings-docker.xml /root/.m2/settings.xml

COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src/ src/
RUN mvn package -DskipTests -B

# ── 阶段 2: 运行 ──
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# 创建非 root 用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8080
USER appuser

# JVM 参数: 自适应内存，容器感知
ENTRYPOINT ["java", \
    "-XX:+UseContainerSupport", \
    "-XX:MaxRAMPercentage=75.0", \
    "-jar", "app.jar"]
