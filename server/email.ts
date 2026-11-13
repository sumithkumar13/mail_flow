import nodemailer from "nodemailer";
import type { User } from "@shared/schema";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function looksLikeHtml(input: string) {
  // Very small heuristic: if it contains an HTML-ish tag, treat as HTML.
  return /<\s*\/?\s*[a-z][\s\S]*?>/i.test(input);
}

function normalizeHtmlEmail(html: string) {
  // Goal: avoid extra spacing between sentences. Only keep spacing between:
  // greeting block, ONE body paragraph, closing block.

  const pMatches = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi));

  // If we can parse multiple <p> blocks, collapse them into 3 blocks:
  // first=<greeting>, middle=<body>, last=<closing>.
  if (pMatches.length >= 3) {
    const contents = pMatches.map((m) => m[1].trim()).filter(Boolean);
    if (contents.length >= 3) {
      const first = contents[0];
      const last = contents[contents.length - 1];
      const middle = contents.slice(1, -1).join(" ");

      const rebuilt = [
        `<p style="margin:0 0 12px 0;">${first}</p>`,
        `<p style="margin:0 0 12px 0;">${middle}</p>`,
        `<p style="margin:0;">${last}</p>`,
      ].join("\n");

      return `<!doctype html><html><body style="font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.5; color:#111;">${rebuilt}</body></html>`;
    }
  }

  // Fallback: keep the HTML, but enforce tight <p> margins.
  let out = html;
  out = out.replace(/<p>/gi, '<p style="margin:0;">');
  out = out.replace(/<p(?![^>]*\sstyle=)([^>]*)>/gi, '<p$1 style="margin:0;">');

  if (!/<\s*html[\s>]/i.test(out)) {
    out = `<!doctype html><html><body style="font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.5; color:#111;">${out}</body></html>`;
  }

  return out;
}

function htmlToText(html: string) {
  return html
    .replace(/\r\n?/g, "\n")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*p(\s[^>]*)?>/gi, "")
    .replace(/<\s*\/\s*div\s*>/gi, "\n")
    .replace(/<\s*div(\s[^>]*)?>/gi, "")
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, "\n\n")
    .replace(/<\s*h[1-6](\s[^>]*)?>/gi, "")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<\s*li(\s[^>]*)?>/gi, "- ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function textToHtml(text: string) {
  const normalized = text.replace(/\r\n?/g, "\n");

  // If the user pasted/entered a full email as one long line, add a bit of structure.
  // We only do this when there are *no* newlines at all.
  const maybeStructured = /\n/.test(normalized)
    ? normalized
    : normalized
        // Greeting
        .replace(/^(Dear[^,]{0,80},)\s+/i, "$1\n\n")
        .replace(/^(Hi[^,]{0,80},)\s+/i, "$1\n\n")
        .replace(/^(Hello[^,]{0,80},)\s+/i, "$1\n\n")
        // Closing phrases
        .replace(/\s+(Best regards,?)/i, "\n\n$1")
        .replace(/\s+(Kind regards,?)/i, "\n\n$1")
        .replace(/\s+(Sincerely,?)/i, "\n\n$1")
        .replace(/\s+(Regards,?)/i, "\n\n$1")
        .replace(/\s+(Thank you,?)/i, "\n\n$1")
        .replace(/\s+(Thanks,?)/i, "\n\n$1");

  const paragraphs = maybeStructured
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (!paragraphs.length) return "<p></p>";

  const body = paragraphs
    .map((p) => `<p style="margin:0 0 8px 0;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("\n");

  // Full document wrapper tends to render more consistently across clients.
  return `<!doctype html><html><body style="font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.5; color:#111;">${body}</body></html>`;
}

function deriveEmailBodies(options: EmailOptions): { text: string; html: string } {
  // Prefer explicit HTML, but normalize if it's actually plain text.
  const primary = options.html ?? options.text;

  if (looksLikeHtml(primary)) {
    const normalizedHtml = normalizeHtmlEmail(primary);
    return {
      html: normalizedHtml,
      text: options.text?.trim() ? options.text : htmlToText(normalizedHtml),
    };
  }

  const plain = primary;
  return {
    text: plain,
    html: textToHtml(plain),
  };
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
}

export async function sendEmail(user: User, options: EmailOptions): Promise<void> {
  // Check if user has SMTP configured
  if (!user.smtpHost || !user.smtpUser || !user.smtpPassword) {
    throw new Error("SMTP credentials not configured. Please configure in Settings.");
  }

  // Create transporter with user's SMTP settings
  const transporter = nodemailer.createTransport({
    host: user.smtpHost,
    port: parseInt(user.smtpPort || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: user.smtpUser,
      pass: user.smtpPassword,
    },
  });

  const { text, html } = deriveEmailBodies(options);

  if (process.env.EMAIL_DEBUG === "1") {
    const preview = (s: string) =>
      s.length <= 400 ? s : `${s.slice(0, 400)}… (len=${s.length})`;

    console.log("[email_debug] sending", {
      to: options.to,
      subject: options.subject,
      textPreview: preview(text),
      htmlPreview: preview(html),
      textHasNewlines: /\r|\n/.test(text),
      htmlHasTags: /<\s*\/?\s*[a-z][\s\S]*?>/i.test(html),
    });
  }

  // Send email
  await transporter.sendMail({
    from: `"${user.name}" <${user.smtpUser}>`,
    to: options.to,
    subject: options.subject,
    text,
    html,
    attachments: options.attachments,
  });
}

export async function sendBulkEmails(
  user: User,
  recipients: string[],
  subject: string,
  message: string,
  attachments?: nodemailer.SendMailOptions["attachments"]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const recipient of recipients) {
    try {
      await sendEmail(user, {
        to: recipient.trim(),
        subject,
        text: message,
        html: message,
        attachments,
      });
      results.sent++;
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      results.failed++;
      results.errors.push(`${recipient}: ${error.message}`);
    }
  }

  return results;
}
