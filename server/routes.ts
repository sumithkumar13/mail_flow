import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendEmail, sendBulkEmails } from "./email";
import { generateEmailContent } from "./ai";
import bcrypt from "bcryptjs";
import session from "express-session";
import { loginSchema, signupSchema, insertEmailLogSchema, type User, type EmailLog } from "@shared/schema";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { AttachmentPreview } from "@shared/types";
import {
  parseAttachmentPayloads,
  parseAttachmentPayloadsFromColumn,
  serializeAttachmentPayloads,
  createMailerAttachments,
  attachmentPreviews,
} from "./attachment-utils";

// Extend session data
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

type ApiEmailLog = Omit<EmailLog, "attachments"> & {
  attachments?: AttachmentPreview[];
};

function toApiEmailLog(log: EmailLog): ApiEmailLog {
  const payloads = parseAttachmentPayloadsFromColumn(log.attachments);
  return {
    ...log,
    attachments: attachmentPreviews(payloads),
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "mailflow-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      },
    })
  );

  // Auth middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    req.user = user;
    next();
  };

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      console.log("[signup] incoming body:", req.body);
      const data = signupSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user
      const user = await storage.createUser({
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: "user",
        status: "active",
      });

      // Create session
      req.session.userId = user.id;

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("[signup] error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromError(error).toString() });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(data.password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Update last active
      await storage.updateUser(user.id, { lastActive: new Date() });

      // Create session
      req.session.userId = user.id;

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromError(error).toString() });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, (req: any, res) => {
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Settings routes
  app.patch("/api/settings/smtp", requireAuth, async (req: any, res) => {
    try {
      const { smtpHost, smtpPort, smtpUser, smtpPassword } = req.body;
      
      const updatedUser = await storage.updateUser(req.user.id, {
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/settings/ai", requireAuth, async (req: any, res) => {
    try {
      const { groqApiKey } = req.body;
      
      const updatedUser = await storage.updateUser(req.user.id, {
        groqApiKey,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // AI routes
  app.post("/api/ai/generate-email", requireAuth, async (req: any, res) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const result = await generateEmailContent(req.user, prompt);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Email routes
  app.post("/api/emails/draft", requireAuth, async (req: any, res) => {
    try {
      const { type } = req.body as { type?: "single" | "bulk" };
      const draftType: "single" | "bulk" = type === "bulk" ? "bulk" : "single";

      const { recipient, recipients, subject, message, messageHtml } = req.body as {
        recipient?: string;
        recipients?: string;
        subject?: string;
        message?: string;
        messageHtml?: string;
      };

      const hasAnyContent = Boolean((recipient || recipients || "").trim() || (subject || "").trim() || (message || "").trim());
      if (!hasAnyContent) {
        return res.status(400).json({ message: "Draft is empty" });
      }

      const attachmentsPayloads = parseAttachmentPayloads(req.body.attachments);
      const attachmentsJson = serializeAttachmentPayloads(attachmentsPayloads);

      if (draftType === "bulk") {
        if (!recipients) {
          return res.status(400).json({ message: "Recipients are required for bulk drafts" });
        }

        const recipientList = recipients
          .split(/[\n,]+/)
          .map((email: string) => email.trim())
          .filter((email: string) => email.length > 0);

        const log = await storage.createEmailLog({
          userId: req.user.id,
          recipient: `Draft: ${recipientList.length} recipients`,
          recipients: JSON.stringify(recipientList),
          subject: subject || "(no subject)",
          message: messageHtml || message || "",
          status: "draft",
          type: "bulk",
          scheduledAt: null,
          attachments: attachmentsJson,
        });

        return res.json({
          message: "Draft saved",
          log: toApiEmailLog(log),
        });
      }

      if (!recipient) {
        return res.status(400).json({ message: "Recipient is required for single drafts" });
      }

      const log = await storage.createEmailLog({
        userId: req.user.id,
        recipient,
        subject: subject || "(no subject)",
        message: messageHtml || message || "",
        status: "draft",
        type: "single",
        scheduledAt: null,
        attachments: attachmentsJson,
      });

      return res.json({
        message: "Draft saved",
        log: toApiEmailLog(log),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/emails/draft/:id", requireAuth, async (req: any, res) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ message: "Draft id is required" });
      }

      const { type } = req.body as { type?: "single" | "bulk" };
      const draftType: "single" | "bulk" = type === "bulk" ? "bulk" : "single";

      const { recipient, recipients, subject, message, messageHtml } = req.body as {
        recipient?: string;
        recipients?: string;
        subject?: string;
        message?: string;
        messageHtml?: string;
      };

      const attachmentsPayloads = parseAttachmentPayloads(req.body.attachments);
      const attachmentsJson = serializeAttachmentPayloads(attachmentsPayloads);

      if (draftType === "bulk") {
        if (!recipients) {
          return res.status(400).json({ message: "Recipients are required for bulk drafts" });
        }

        const recipientList = recipients
          .split(/[\n,]+/)
          .map((email: string) => email.trim())
          .filter((email: string) => email.length > 0);

        const updated = await storage.updateDraftEmailLog(req.user.id, id, {
          recipient: `Draft: ${recipientList.length} recipients`,
          recipients: JSON.stringify(recipientList),
          subject: subject || "(no subject)",
          message: messageHtml || message || "",
          attachments: attachmentsJson,
          type: "bulk",
        });

        if (!updated) {
          return res.status(404).json({ message: "Draft not found" });
        }

        return res.json({
          message: "Draft updated",
          log: toApiEmailLog(updated),
        });
      }

      if (!recipient) {
        return res.status(400).json({ message: "Recipient is required for single drafts" });
      }

      const updated = await storage.updateDraftEmailLog(req.user.id, id, {
        recipient,
        recipients: null,
        subject: subject || "(no subject)",
        message: messageHtml || message || "",
        attachments: attachmentsJson,
        type: "single",
      });

      if (!updated) {
        return res.status(404).json({ message: "Draft not found" });
      }

      return res.json({
        message: "Draft updated",
        log: toApiEmailLog(updated),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/emails/draft/:id", requireAuth, async (req: any, res) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ message: "Draft id is required" });
      }

      const deleted = await storage.deleteDraftEmailLog(req.user.id, id);
      if (!deleted) {
        return res.status(404).json({ message: "Draft not found" });
      }

      return res.json({ message: "Draft removed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/emails/send", requireAuth, async (req: any, res) => {
    try {
      const { draftId, recipient, subject, message, messageHtml, scheduledAt } = req.body;
      const attachmentsPayloads = parseAttachmentPayloads(req.body.attachments);
      const attachmentsJson = serializeAttachmentPayloads(attachmentsPayloads);
      const mailerAttachments = createMailerAttachments(attachmentsPayloads);

      if (!recipient || !subject || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const scheduleDate = scheduledAt ? new Date(scheduledAt) : null;
      const isFutureSchedule = scheduleDate && scheduleDate > new Date();

      // If this send is based on a draft, update that draft record instead of creating a new log.
      const log = draftId
        ? await storage.promoteDraftEmailLog(req.user.id, String(draftId), {
            recipient,
            recipients: null,
            subject,
            message,
            status: isFutureSchedule ? "scheduled" : "sending",
            type: "single",
            scheduledAt: scheduleDate,
            attachments: attachmentsJson,
          })
        : await storage.createEmailLog({
            userId: req.user.id,
            recipient,
            subject,
            message,
            status: isFutureSchedule ? "scheduled" : "sending",
            type: "single",
            scheduledAt: scheduleDate,
            attachments: attachmentsJson,
          });

      if (!log) {
        return res.status(404).json({ message: "Draft not found" });
      }

      // If scheduled for future, don't send now
      if (isFutureSchedule) {
        return res.json({
          message: `Email scheduled for ${scheduleDate.toLocaleString()}`,
          log: toApiEmailLog(log),
        });
      }

      // Send email immediately
      try {
        await sendEmail(req.user, {
          to: recipient,
          subject,
          text: message,
          html: messageHtml,
          attachments: mailerAttachments,
        });

        // Update log status
        await storage.updateEmailLogStatus(log.id, "sent");
        await storage.updateEmailLogSentAt(log.id);
        await storage.updateUserEmailCount(req.user.id);

        const sentAt = new Date();
        res.json({
          message: "Email sent successfully",
          log: toApiEmailLog({
            ...log,
            status: "sent",
            sentAt,
          }),
        });
      } catch (error: any) {
        // Update log status to failed
        await storage.updateEmailLogStatus(log.id, "failed");
        throw error;
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/emails/send-bulk", requireAuth, async (req: any, res) => {
    try {
      const { draftId, recipients, subject, message, messageHtml, scheduledAt } = req.body;
      const attachmentsPayloads = parseAttachmentPayloads(req.body.attachments);
      const attachmentsJson = serializeAttachmentPayloads(attachmentsPayloads);
      const mailerAttachments = createMailerAttachments(attachmentsPayloads);

      if (!recipients || !subject || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const recipientList = recipients
        .split(/[\n,]+/)
        .map((email: string) => email.trim())
        .filter((email: string) => email.length > 0);

      if (recipientList.length === 0) {
        return res.status(400).json({ message: "No valid recipients provided" });
      }

      const scheduleDate = scheduledAt ? new Date(scheduledAt) : null;
      const isFutureSchedule = scheduleDate && scheduleDate > new Date();

      const log = draftId
        ? await storage.promoteDraftEmailLog(req.user.id, String(draftId), {
            recipient: `Bulk: ${recipientList.length} recipients`,
            recipients: JSON.stringify(recipientList),
            subject,
            message: messageHtml || message,
            status: isFutureSchedule ? "scheduled" : "sending",
            type: "bulk",
            scheduledAt: scheduleDate,
            attachments: attachmentsJson,
          })
        : await storage.createEmailLog({
            userId: req.user.id,
            recipient: `Bulk: ${recipientList.length} recipients`,
            recipients: JSON.stringify(recipientList),
            subject,
            message: messageHtml || message,
            status: isFutureSchedule ? "scheduled" : "sending",
            type: "bulk",
            scheduledAt: scheduleDate,
            attachments: attachmentsJson,
          });

      if (!log) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (isFutureSchedule) {
        return res.json({
          message: `Bulk email scheduled for ${scheduleDate.toLocaleString()} (${recipientList.length} recipients)`,
          log: toApiEmailLog(log),
        });
      }

      const results = await sendBulkEmails(
        req.user,
        recipientList,
        subject,
        messageHtml || message,
        mailerAttachments
      );

      const status = results.failed === 0 ? "sent" : results.sent > 0 ? "partial" : "failed";
      await storage.updateEmailLogStatus(log.id, status);
      await storage.updateEmailLogSentAt(log.id);

      if (results.sent > 0) {
        for (let i = 0; i < results.sent; i++) {
          await storage.updateUserEmailCount(req.user.id);
        }
      }

      const sentAt = new Date();
      res.json({
        message: `Bulk send completed: ${results.sent} sent, ${results.failed} failed`,
        results,
        log: toApiEmailLog({
          ...log,
          status,
          sentAt,
        }),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/emails/logs", requireAuth, async (req: any, res) => {
    try {
      const logs = await storage.getEmailLogsByUser(req.user.id);
      res.json(logs.map(toApiEmailLog));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/emails/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ message: "Email log id is required" });
      }

      const canceled = await storage.cancelScheduledEmail(req.user.id, id);
      if (!canceled) {
        return res.status(400).json({
          message: "Only pending scheduled emails can be canceled.",
        });
      }

      res.json({
        message: "Scheduled email canceled",
        log: toApiEmailLog(canceled),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin routes
  app.get("/api/admin/users", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/logs", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const logs = await storage.getAllEmailLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
