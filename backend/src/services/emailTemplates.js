/**
 * Responsive HTML Email Templates for ArchScale Auth
 */

function baseLayout(content, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArchScale</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0d1117;
      color: #e6edf3;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0d1117;
      padding: 40px 16px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 36px 32px;
    }
    .logo-container {
      text-align: center;
      margin-bottom: 28px;
    }
    .logo-text {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #ffffff;
      text-decoration: none;
    }
    .logo-highlight {
      color: #4f7df9;
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      color: #f0f6fc;
      margin-top: 0;
      margin-bottom: 16px;
      line-height: 1.3;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #8b949e;
      margin: 0 0 16px 0;
    }
    .btn {
      display: inline-block;
      padding: 13px 28px;
      background-color: #4f7df9;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      border-radius: 8px;
      margin: 20px 0 24px 0;
      text-align: center;
    }
    .link-alt {
      font-size: 13px;
      color: #6e7681;
      word-break: break-all;
      margin-top: 12px;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #484f58;
      margin-top: 32px;
      border-top: 1px solid #21262d;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#0d1117;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  <table class="wrapper" role="presentation">
    <tr>
      <td align="center">
        <div class="container">
          <div class="logo-container">
            <span class="logo-text">Arch<span class="logo-highlight">Scale</span></span>
          </div>
          ${content}
          <div class="footer">
            ArchScale Platform &bull; Collaboration for project owners, studios & vendors<br>
            If you did not request this email, you can safely disregard it.
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function invitationEmail({ link, tenantType, organizationName, invitedEmail, expiresAt }) {
  const roleName = tenantType
    ? tenantType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Member';

  const orgMention = organizationName ? ` to collaborate with <strong>${organizationName}</strong>` : '';

  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null;

  const expiryText = formattedExpiry
    ? `This invitation is valid for 72 hours and will expire on <strong>${formattedExpiry}</strong>.`
    : `This invitation link will expire in 72 hours.`;

  const content = `
    <h1>You're invited to ArchScale</h1>
    <p>You have been invited${orgMention} as a <strong>${roleName}</strong> on the ArchScale workspace platform.</p>
    <p>ArchScale accounts are created by invitation only. Click the secure button below to configure your credentials and activate your workspace access:</p>
    <div style="text-align:center;">
      <a href="${link}" class="btn" target="_blank">Accept Invitation & Activate Account</a>
    </div>
    <p class="link-alt">If the button does not open, copy and paste this address into your browser:<br><a href="${link}" style="color:#4f7df9;">${link}</a></p>
    <p style="font-size: 13px; color: #8b949e; margin-top: 24px;">${expiryText}</p>
    <p style="font-size: 12px; color: #6e7681; margin-top: 8px;">If you were not expecting this invitation, you can safely disregard this email.</p>
  `;

  return {
    subject: `ArchScale Invitation: Join as a ${roleName}`,
    html: baseLayout(content, 'You have been invited to join the ArchScale platform.'),
  };
}

export function resetPasswordEmail({ link, userName, expiresAt }) {
  const greeting = userName ? `Hello ${userName},` : 'Hello,';

  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null;

  const expiryText = formattedExpiry
    ? `This security link will expire on <strong>${formattedExpiry}</strong> (1 hour).`
    : `This link will expire in 1 hour.`;

  const content = `
    <h1>Password Reset Request</h1>
    <p>${greeting}</p>
    <p>We received a request to reset your ArchScale account password. Click the button below to choose your new password:</p>
    <div style="text-align:center;">
      <a href="${link}" class="btn" target="_blank">Reset Password</a>
    </div>
    <p class="link-alt">If the button does not open, copy and paste this address into your browser:<br><a href="${link}" style="color:#4f7df9;">${link}</a></p>
    <p style="font-size: 13px; color: #8b949e; margin-top: 24px;">${expiryText} If you did not request this, your account remains secure and no action is required.</p>
  `;

  return {
    subject: 'Reset your ArchScale password',
    html: baseLayout(content, 'Reset your ArchScale account password.'),
  };
}

export function verifyEmailEmail({ link, userName, expiresAt }) {
  const greeting = userName ? `Hello ${userName},` : 'Hello,';

  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null;

  const expiryText = formattedExpiry
    ? `This verification link will expire on <strong>${formattedExpiry}</strong> (24 hours).`
    : `This verification link will expire in 24 hours.`;

  const content = `
    <h1>Verify your email address</h1>
    <p>${greeting}</p>
    <p>Please confirm your email address for your ArchScale account by clicking the button below:</p>
    <div style="text-align:center;">
      <a href="${link}" class="btn" target="_blank">Verify Email</a>
    </div>
    <p class="link-alt">If the button does not open, copy and paste this address into your browser:<br><a href="${link}" style="color:#4f7df9;">${link}</a></p>
    <p style="font-size: 13px; color: #8b949e; margin-top: 24px;">${expiryText}</p>
  `;

  return {
    subject: 'Verify your ArchScale email address',
    html: baseLayout(content, 'Verify your email address for ArchScale.'),
  };
}

export function passwordChangedEmail({ userName }) {
  const greeting = userName ? `Hello ${userName},` : 'Hello,';
  const content = `
    <h1>Password Changed Successfully</h1>
    <p>${greeting}</p>
    <p>The password for your ArchScale account was recently changed. All other active sessions have been automatically signed out for your security.</p>
    <p>If you did not perform this change, please contact ArchScale security immediately at <a href="mailto:hello@archscale.in" style="color:#4f7df9;">hello@archscale.in</a>.</p>
  `;

  return {
    subject: 'Security Alert: Your ArchScale password was changed',
    html: baseLayout(content, 'Your ArchScale password was recently changed.'),
  };
}
