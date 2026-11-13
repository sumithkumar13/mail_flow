export interface AttachmentPayload {
  filename: string;
  mimeType?: string;
  data: string;
}

export interface AttachmentPreview {
  filename: string;
  mimeType?: string;
  size?: number;
}
