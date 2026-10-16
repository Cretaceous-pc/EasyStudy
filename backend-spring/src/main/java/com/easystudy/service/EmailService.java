package com.easystudy.service;

import com.easystudy.exception.BusinessException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String mailFrom;

    /**
     * 生成 6 位数字验证码
     */
    public String generateCode() {
        int code = ThreadLocalRandom.current().nextInt(100000, 1000000);
        return String.valueOf(code);
    }

    /**
     * 发送验证码邮件
     */
    public void sendVerificationCode(String toEmail, String code) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(mailFrom);
            helper.setTo(toEmail);
            helper.setSubject("easyStudy - 密码重置验证码");
            helper.setText(buildEmailContent(code), true);

            mailSender.send(message);
            log.info("Verification code sent to email: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send email to {}: {}", toEmail, e.getMessage());
            throw new BusinessException(50002, "邮件发送失败，请稍后重试", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private String buildEmailContent(String code) {
        return """
                <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #faf9f5; border: 1px solid #f0eee6; border-radius: 12px;">
                  <h1 style="font-size: 20px; color: #141413; margin-bottom: 16px;">
                    <span style="color: #c96442;">easyStudy</span> 密码重置
                  </h1>
                  <p style="color: #4d4c48; line-height: 1.6;">
                    您正在重置密码，验证码如下：
                  </p>
                  <div style="margin: 24px 0; padding: 16px 24px; background: #f5f4ed; border-radius: 8px; text-align: center;">
                    <span style="font-family: monospace; font-size: 28px; color: #c96442; letter-spacing: 4px; font-weight: 600;">%s</span>
                  </div>
                  <p style="color: #87867f; font-size: 13px; line-height: 1.5;">
                    验证码 5 分钟内有效。如果这不是您本人的操作，请忽略此邮件。
                  </p>
                  <hr style="border: none; border-top: 1px solid #f0eee6; margin: 24px 0 12px;" />
                  <p style="color: #b0aea5; font-size: 12px;">
                    此邮件由系统自动发送，请勿回复。
                  </p>
                </div>
                """.formatted(code);
    }
}
