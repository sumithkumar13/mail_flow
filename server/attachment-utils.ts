import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import { AttachmentPayload, AttachmentPreview } from "@shared/types";

const BASE64_PREFIX_REGEX = /^data:.*?;base64,/i;

function stripDataPrefix(value: string): string {
  return value.replace(BASE64_PREFIX_REGEX, "");
}

function isPayload(value: unknown): value is AttachmentPayload {
  if (!value || typeof value !== "object") return false;
  const { filename, data } = value as Record<string, unknown>;
  return typeof filename === "string" && typeof data === "string";
}

function decodeBuffer(payload: AttachmentPayload): Buffer | null {
  try {
    const cleaned = stripDataPrefix(payload.data);
    return Buffer.from(cleaned, "base64");
  } catch (error) {
    console.error("Failed to decode attachment", payload.filename, error);
    return null;
  }
}

export function parseAttachmentPayloads(raw?: unknown): AttachmentPayload[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => (isPayload(entry) ? entry : null))
    .filter((entry): entry is AttachmentPayload => Boolean(entry));
}

export function parseAttachmentPayloadsFromColumn(column?: string | null): AttachmentPayload[] {
  if (!column) return [];
  try {
    const parsed = JSON.parse(column);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is AttachmentPayload => isPayload(entry));
  } catch (error) {
    console.error("Failed to parse stored attachments", error);
    return [];
  }
}

export function serializeAttachmentPayloads(payloads: AttachmentPayload[]): string | null {
  if (!payloads.length) return null;
  return JSON.stringify(payloads);
}

export function createMailerAttachments(payloads: AttachmentPayload[]): Attachment[] {
  return payloads.flatMap((payload) => {
    const buffer = decodeBuffer(payload);
    if (!buffer) return [];
    return [
      {
        filename: payload.filename,
        content: buffer,
        contentType: payload.mimeType || undefined,
      },
    ];
  });
}

export function attachmentPreviews(payloads: AttachmentPayload[]): AttachmentPreview[] {
  return payloads.map((payload) => {
    const buffer = decodeBuffer(payload);
    return {
      filename: payload.filename,
      mimeType: payload.mimeType,
      size: buffer?.length,
    };
  });
}
