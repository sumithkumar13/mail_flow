import type { AttachmentPayload, AttachmentPreview } from "@shared/types";

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  emailsSent: number;
  lastActive: string;
  smtpHost?: string | null;
  smtpPort?: string | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  groqApiKey?: string | null;
}

export interface EmailLog {
  id: string;
  userId: string;
  recipient: string;
  recipients?: string | null;
  subject: string;
  message: string;
  error?: string | null;
  status: 'draft' | 'sending' | 'sent' | 'failed' | 'queued' | 'partial' | 'scheduled' | 'canceled';
  type: 'single' | 'bulk';
  scheduledAt?: string;
  sentAt?: string;
  canceledAt?: string;
  createdAt: string;
  attachments?: AttachmentPreview[];
}

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async signup(data: { name: string; email: string; password: string }): Promise<User> {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }): Promise<User> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  async getMe(): Promise<User> {
    return this.request('/auth/me');
  }

  // Settings
  async updateSmtp(data: {
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpPassword: string;
  }): Promise<User> {
    return this.request('/settings/smtp', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateAI(data: {
    groqApiKey: string;
  }): Promise<User> {
    return this.request('/settings/ai', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // AI
  async generateEmail(prompt: string): Promise<{ subject: string; message: string; messageHtml?: string }> {
    return this.request('/ai/generate-email', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  // Emails
  async saveDraft(data: {
    type: 'single' | 'bulk';
    recipient?: string;
    recipients?: string;
    subject?: string;
    message?: string;
    messageHtml?: string;
    attachments?: AttachmentPayload[];
  }): Promise<{ message: string; log: EmailLog }> {
    return this.request('/emails/draft', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDraft(
    id: string,
    data: {
      type: 'single' | 'bulk';
      recipient?: string;
      recipients?: string;
      subject?: string;
      message?: string;
      messageHtml?: string;
      attachments?: AttachmentPayload[];
    }
  ): Promise<{ message: string; log: EmailLog }> {
    return this.request(`/emails/draft/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDraft(id: string): Promise<{ message: string }> {
    return this.request(`/emails/draft/${id}`, {
      method: 'DELETE',
    });
  }

  async sendEmail(data: {
    recipient: string;
    subject: string;
    message: string;
    messageHtml?: string;
    scheduledAt?: string;
    attachments?: AttachmentPayload[];
    draftId?: string;
  }): Promise<{ message: string; log: EmailLog }> {
    return this.request('/emails/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendBulkEmail(data: {
    recipients: string;
    subject: string;
    message: string;
    messageHtml?: string;
    scheduledAt?: string;
    attachments?: AttachmentPayload[];
    draftId?: string;
  }): Promise<{ message: string; results: any; log: EmailLog }> {
    return this.request('/emails/send-bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEmailLogs(): Promise<EmailLog[]> {
    return this.request('/emails/logs');
  }

  async cancelScheduledEmail(id: string): Promise<{ message: string; log: EmailLog }> {
    return this.request(`/emails/${id}/cancel`, {
      method: 'POST',
    });
  }

  // Admin
  async getAllUsers(): Promise<User[]> {
    return this.request('/admin/users');
  }

  async getAllLogs(): Promise<EmailLog[]> {
    return this.request('/admin/logs');
  }
}

export const api = new ApiClient();
