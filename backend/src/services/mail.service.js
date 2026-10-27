import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import {
  invitationEmail,
  resetPasswordEmail,
  verifyEmailEmail,
  passwordChangedEmail,
} from './emailTemplates.js';

// 1. Initialize Resend if API key is provided
let resendInstance = null;
if (env.MAIL_PROVIDER_KEY && env.MAIL_PROVIDER_KEY.startsWith('re_')) {
  resendInstance = new Resend(env.MAIL_PROVIDER_KEY);
}

// 2. Initialize Nodemailer SMTP transporter if SMTP config is provided
let smtpTransporter = null;
if (env.SMTP_USER && env.SMTP_PASS) {
  if (env.SMTP_SERVICE) {
    smtpTransporter = nodemailer.createTransport({
      service: env.SMTP_SERVICE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  } else if (env.SMTP_HOST) {
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
} else if (env.SMTP_HOST) {
  smtpTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
  });
}

class MailService {
  /**
   * Log action link clearly to dev console
   */
  logDevEmailFallback({ to, from, subject, html, reason }) {
    console.log('\n================== [MAIL (DEV CONSOLE)] ==================');
    if (reason) console.log(`Notice: ${reason}`);
    console.log(`To:      ${to}`);
    console.log(`From:    ${from || env.MAIL_FROM}`);
    console.log(`Subject: ${subject}`);
    const linkMatch = html.match(/href="([^"]+)"/);
    if (linkMatch) {
      console.log(`🔗 Action Link: ${linkMatch[1]}`);
    }
    console.log('==========================================================\n');
  }

  /**
   * Send email via SMTP (Nodemailer)
   */
  async sendViaSmtp({ to, subject, html, from }) {
    if (!smtpTransporter) {
      return { success: false, provider: 'smtp', error: 'SMTP transporter not configured' };
    }

    try {
      const fromAddress = from || (env.SMTP_USER ? `ArchScale Auth <${env.SMTP_USER}>` : env.MAIL_FROM);
      const info = await smtpTransporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      });
      console.log(`✅ [SMTP] Email sent to ${to} (MessageId: ${info.messageId})`);
      return { success: true, provider: 'smtp', info };
    } catch (err) {
      console.error(`❌ [SMTP] Error sending email to ${to}:`, err.message);
      return { success: false, provider: 'smtp', error: err.message };
    }
  }

  /**
   * Send email via Resend API
   */
  async sendViaResend({ to, subject, html, from }) {
    if (!resendInstance) {
      return { success: false, provider: 'resend', error: 'Resend API key not configured' };
    }

    // Determine initial sender
    let fromAddress = from || env.MAIL_FROM;

    // If MAIL_FROM contains @archscale.in and domain is not verified, use onboarding@resend.dev
    if (fromAddress.includes('@archscale.in')) {
      fromAddress = 'ArchScale Auth <onboarding@resend.dev>';
    }

    try {
      const res = await resendInstance.emails.send({
        from: fromAddress,
        to,
        subject,
        html,
      });

      // Crucial: Resend SDK returns { data, error } and does NOT throw on API errors
      if (res.error) {
        console.warn(`⚠️ [Resend] Failed to send to ${to}: ${res.error.message} (Status: ${res.error.statusCode})`);

        // If error was unverified domain and we used a custom domain, retry with onboarding@resend.dev
        if (
          res.error.message?.toLowerCase().includes('not verified') &&
          !fromAddress.includes('onboarding@resend.dev')
        ) {
          console.log('🔄 [Resend] Retrying with onboarding@resend.dev fallback...');
          const retryRes = await resendInstance.emails.send({
            from: 'ArchScale Auth <onboarding@resend.dev>',
            to,
            subject,
            html,
          });

          if (!retryRes.error) {
            console.log(`✅ [Resend] Email sent to ${to} using onboarding@resend.dev (ID: ${retryRes.data?.id})`);
            return { success: true, provider: 'resend', data: retryRes.data, fallbackSender: true };
          }
          return { success: false, provider: 'resend', error: retryRes.error.message };
        }

        return { success: false, provider: 'resend', error: res.error.message };
      }

      console.log(`✅ [Resend] Email sent to ${to} (ID: ${res.data?.id})`);
      return { success: true, provider: 'resend', data: res.data };
    } catch (err) {
      console.error(`❌ [Resend] Network error sending to ${to}:`, err.message);
      return { success: false, provider: 'resend', error: err.message };
    }
  }

  /**
   * Core sendMail dispatcher with automatic provider selection and fallback
   */
  async sendMail({ to, subject, html, from }) {
    const preferredProvider = env.MAIL_PROVIDER; // 'auto' | 'smtp' | 'resend' | 'console'

    if (preferredProvider === 'console') {
      this.logDevEmailFallback({ to, from, subject, html, reason: 'Console mode active' });
      return { success: true, provider: 'console', mock: true };
    }

    // If explicit SMTP selected
    if (preferredProvider === 'smtp' && smtpTransporter) {
      const result = await this.sendViaSmtp({ to, subject, html, from });
      if (result.success) return result;
      // Fallback to dev console if non-production
      if (env.NODE_ENV !== 'production') {
        this.logDevEmailFallback({ to, from, subject, html, reason: `SMTP failed: ${result.error}` });
      }
      return result;
    }

    // If explicit Resend selected
    if (preferredProvider === 'resend' && resendInstance) {
      const result = await this.sendViaResend({ to, subject, html, from });
      if (result.success) return result;
      if (env.NODE_ENV !== 'production') {
        this.logDevEmailFallback({ to, from, subject, html, reason: `Resend failed: ${result.error}` });
      }
      return result;
    }

    // Auto mode:
    // If SMTP is configured, SMTP can deliver to ANY email address without domain limits
    if (smtpTransporter) {
      const smtpRes = await this.sendViaSmtp({ to, subject, html, from });
      if (smtpRes.success) return smtpRes;
      console.warn('⚠️ SMTP failed, attempting Resend fallback...');
    }

    // Try Resend if configured
    if (resendInstance) {
      const resendRes = await this.sendViaResend({ to, subject, html, from });
      if (resendRes.success) return resendRes;

      // In dev, provide console fallback so links are never lost
      if (env.NODE_ENV !== 'production') {
        this.logDevEmailFallback({
          to,
          from,
          subject,
          html,
          reason: `Mail provider failed (${resendRes.error}). Dev link logged below:`,
        });
      }
      return resendRes;
    }

    // Neither SMTP nor Resend configured -> Dev console fallback
    this.logDevEmailFallback({
      to,
      from,
      subject,
      html,
      reason: 'No external mail provider configured (print-only mode)',
    });
    return { success: true, provider: 'console', mock: true };
  }

  async sendInvite({ to, link, tenantType, organizationName, expiresAt }) {
    const { subject, html } = invitationEmail({
      link,
      tenantType,
      organizationName,
      invitedEmail: to,
      expiresAt,
    });
    return this.sendMail({ to, subject, html });
  }

  async sendResetPassword({ to, link, userName, expiresAt }) {
    const { subject, html } = resetPasswordEmail({ link, userName, expiresAt });
    return this.sendMail({ to, subject, html });
  }

  async sendVerifyEmail({ to, link, userName, expiresAt }) {
    const { subject, html } = verifyEmailEmail({ link, userName, expiresAt });
    return this.sendMail({ to, subject, html });
  }

  async sendPasswordChangedNotice({ to, userName }) {
    const { subject, html } = passwordChangedEmail({ userName });
    return this.sendMail({ to, subject, html });
  }
}

export const mailService = new MailService();
