'use strict';

const logger = require('../utils/logger');
const config = require('../config');

// ── Email template renderer ───────────────────────────────────
const templates = {
  'email-verification': ({ name, token }) => ({
    subject: 'Verify your SkillSwap email',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0F1E33;color:#EEF2FF;padding:32px;border-radius:16px">
        <h1 style="font-size:24px;margin-bottom:8px">Welcome to SkillSwap, ${name}!</h1>
        <p style="color:#9AAEC8;margin-bottom:24px">Your verification code is:</p>
        <div style="background:#1B3A6B;border:1px solid #2A4466;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#5AA3FF">${token}</span>
        </div>
        <p style="color:#9AAEC8;font-size:14px">This code expires in 10 minutes. Do not share it with anyone.</p>
        <hr style="border-color:#1E3455;margin:24px 0"/>
        <p style="color:#5E7A9A;font-size:12px">SkillSwap · Trade Skills, Not Money</p>
      </div>`,
  }),

  'password-reset': ({ name, token }) => ({
    subject: 'Reset your SkillSwap password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0F1E33;color:#EEF2FF;padding:32px;border-radius:16px">
        <h2>Password Reset Request</h2>
        <p style="color:#9AAEC8">Hi ${name}, use this code to reset your password:</p>
        <div style="background:#1B3A6B;border:1px solid #2A4466;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <span style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#5AA3FF">${token}</span>
        </div>
        <p style="color:#9AAEC8;font-size:14px">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>`,
  }),

  'swap-request': ({ senderName, offeredSkill, requestedSkill, introMessage, swapUrl }) => ({
    subject: `${senderName} wants to swap skills with you!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0F1E33;color:#EEF2FF;padding:32px;border-radius:16px">
        <h2>New Swap Request 🔁</h2>
        <p style="color:#9AAEC8"><strong style="color:#EEF2FF">${senderName}</strong> sent you a swap request:</p>
        <div style="background:#13243E;border:1px solid #1E3455;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:4px 0;font-size:14px">They offer: <strong style="color:#2EDEA0">${offeredSkill}</strong></p>
          <p style="margin:4px 0;font-size:14px">They want: <strong style="color:#5AA3FF">${requestedSkill}</strong></p>
          ${introMessage ? `<p style="margin-top:12px;color:#9AAEC8;font-size:13px">"${introMessage}"</p>` : ''}
        </div>
        <a href="${swapUrl}" style="display:inline-block;background:#1E6FD9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">View Request →</a>
      </div>`,
  }),

  'session-reminder': ({ partnerName, sessionTime, swapUrl, isUrgent }) => ({
    subject: isUrgent
      ? `⚡ Your session starts in 30 minutes!`
      : `Reminder: Session with ${partnerName} tomorrow`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0F1E33;color:#EEF2FF;padding:32px;border-radius:16px">
        <h2>${isUrgent ? '⚡ Starting Soon!' : '📅 Session Reminder'}</h2>
        <p style="color:#9AAEC8">Your session with <strong style="color:#EEF2FF">${partnerName}</strong> is ${isUrgent ? 'in 30 minutes' : 'tomorrow'}.</p>
        <div style="background:#13243E;border:1px solid #1E3455;border-radius:12px;padding:16px;margin:16px 0">
          <p style="font-size:18px;font-weight:bold;color:#2EDEA0">🕐 ${sessionTime}</p>
        </div>
        <a href="${swapUrl}" style="display:inline-block;background:${isUrgent ? '#18C77A' : '#1E6FD9'};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
          ${isUrgent ? 'Join Now →' : 'View Session →'}
        </a>
      </div>`,
  }),

  'review-received': ({ reviewerName, rating, feedback, profileUrl }) => ({
    subject: `${reviewerName} left you a ${rating}★ review!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0F1E33;color:#EEF2FF;padding:32px;border-radius:16px">
        <h2>New Review ★</h2>
        <p style="color:#9AAEC8"><strong style="color:#EEF2FF">${reviewerName}</strong> reviewed your session:</p>
        <div style="background:#13243E;border:1px solid #1E3455;border-radius:12px;padding:16px;margin:16px 0">
          <p style="font-size:24px;color:#F5B700">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</p>
          ${feedback ? `<p style="color:#9AAEC8;margin-top:8px">"${feedback}"</p>` : ''}
        </div>
        <a href="${profileUrl}" style="display:inline-block;background:#1E6FD9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">View & Respond →</a>
      </div>`,
  }),

  'swap-accepted': ({ partnerName, swapUrl }) => ({
    subject: `${partnerName} accepted your swap request! 🎉`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0F1E33;color:#EEF2FF;padding:32px;border-radius:16px">
        <h2>Swap Accepted! 🎉</h2>
        <p style="color:#9AAEC8"><strong style="color:#2EDEA0">${partnerName}</strong> accepted your swap request. Time to schedule your first session!</p>
        <a href="${swapUrl}" style="display:inline-block;background:#18C77A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">Schedule First Session →</a>
      </div>`,
  }),

  'welcome': ({ name, dashboardUrl }) => ({
    subject: 'Welcome to SkillSwap! Here\'s how to get started 🚀',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0F1E33;color:#EEF2FF;padding:32px;border-radius:16px">
        <h1>Welcome, ${name}! 🎉</h1>
        <p style="color:#9AAEC8">You've joined 48,000+ people trading skills on SkillSwap. Here's how to make the most of it:</p>
        <ol style="color:#9AAEC8;line-height:2">
          <li>Complete your profile and add your skills</li>
          <li>Browse matches in the Discover page</li>
          <li>Send your first swap request</li>
          <li>Use your 3 welcome SkillCoins to start learning</li>
        </ol>
        <a href="${dashboardUrl}" style="display:inline-block;background:#1E6FD9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">Go to Dashboard →</a>
      </div>`,
  }),
};

/**
 * Send a templated email
 * In production: uses SendGrid API
 * In development: logs to console
 */
const sendEmail = async ({ to, template, data }) => {
  const tmpl = templates[template];
  if (!tmpl) {
    logger.error(`Unknown email template: ${template}`);
    return;
  }

  const { subject, html } = tmpl(data);

  if (process.env.NODE_ENV === 'development' || !config.email.apiKey) {
    logger.info(`[EMAIL] To: ${to} | Subject: ${subject}`);
    logger.debug(`[EMAIL] Body preview: ${html.substring(0, 100)}...`);
    return;
  }

  try {
    // Production: SendGrid
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(config.email.apiKey);

    await sgMail.send({
      to,
      from: { email: config.email.from, name: config.email.fromName },
      subject,
      html,
    });

    logger.info(`Email sent: ${template} → ${to}`);
  } catch (err) {
    logger.error('Email send failed', { error: err.message, to, template });
  }
};

/**
 * Send a bulk notification email
 */
const sendBulkEmail = async (recipients, template, dataFn) => {
  const promises = recipients.map(r => sendEmail({ to: r.email, template, data: dataFn(r) }));
  await Promise.allSettled(promises);
};

module.exports = { sendEmail, sendBulkEmail };
