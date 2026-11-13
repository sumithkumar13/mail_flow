import { type User, type InsertUser, type EmailLog, type InsertEmailLog, users, emailLogs } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserEmailCount(id: string): Promise<void>;
  
  // Email log operations
  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  getEmailLogById(userId: string, emailLogId: string): Promise<EmailLog | undefined>;
  getEmailLogsByUser(userId: string): Promise<EmailLog[]>;
  getAllEmailLogs(): Promise<EmailLog[]>;
  updateEmailLogStatus(id: string, status: string): Promise<void>;
  updateEmailLogSentAt(id: string): Promise<void>;
  updateDraftEmailLog(
    userId: string,
    emailLogId: string,
    updates: Partial<Pick<EmailLog, "recipient" | "recipients" | "subject" | "message" | "attachments" | "type">>
  ): Promise<EmailLog | undefined>;

  promoteDraftEmailLog(
    userId: string,
    emailLogId: string,
    updates: Partial<Pick<EmailLog, "recipient" | "recipients" | "subject" | "message" | "attachments" | "type" | "scheduledAt" | "status">>
  ): Promise<EmailLog | undefined>;

  deleteDraftEmailLog(userId: string, emailLogId: string): Promise<boolean>;
  cancelScheduledEmail(userId: string, emailLogId: string): Promise<EmailLog | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, lastActive: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserEmailCount(id: string): Promise<void> {
    await db
      .update(users)
      .set({ emailsSent: sql`${users.emailsSent} + 1` })
      .where(eq(users.id, id));
  }

  async createEmailLog(log: InsertEmailLog): Promise<EmailLog> {
    const [emailLog] = await db.insert(emailLogs).values(log).returning();
    return emailLog;
  }

  async getEmailLogById(userId: string, emailLogId: string): Promise<EmailLog | undefined> {
    const [log] = await db
      .select()
      .from(emailLogs)
      .where(and(eq(emailLogs.id, emailLogId), eq(emailLogs.userId, userId)));
    return log;
  }

  async getEmailLogsByUser(userId: string): Promise<EmailLog[]> {
    return await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.userId, userId))
      .orderBy(desc(emailLogs.createdAt));
  }

  async getAllEmailLogs(): Promise<EmailLog[]> {
    return await db
      .select()
      .from(emailLogs)
      .orderBy(desc(emailLogs.createdAt));
  }

  async updateEmailLogStatus(id: string, status: string): Promise<void> {
    await db
      .update(emailLogs)
      .set({ status })
      .where(eq(emailLogs.id, id));
  }

  async updateEmailLogSentAt(id: string): Promise<void> {
    await db
      .update(emailLogs)
      .set({ sentAt: new Date() })
      .where(eq(emailLogs.id, id));
  }

  async updateDraftEmailLog(
    userId: string,
    emailLogId: string,
    updates: Partial<Pick<EmailLog, "recipient" | "recipients" | "subject" | "message" | "attachments" | "type">>
  ): Promise<EmailLog | undefined> {
    const [updated] = await db
      .update(emailLogs)
      .set({
        ...updates,
        scheduledAt: null,
        sentAt: null,
        canceledAt: null,
      })
      .where(
        and(
          eq(emailLogs.id, emailLogId),
          eq(emailLogs.userId, userId),
          eq(emailLogs.status, "draft")
        )
      )
      .returning();

    return updated;
  }

  async deleteDraftEmailLog(userId: string, emailLogId: string): Promise<boolean> {
    const deleted = await db
      .delete(emailLogs)
      .where(
        and(
          eq(emailLogs.id, emailLogId),
          eq(emailLogs.userId, userId),
          eq(emailLogs.status, "draft")
        )
      )
      .returning({ id: emailLogs.id });

    return deleted.length > 0;
  }

  async promoteDraftEmailLog(
    userId: string,
    emailLogId: string,
    updates: Partial<Pick<EmailLog, "recipient" | "recipients" | "subject" | "message" | "attachments" | "type" | "scheduledAt" | "status">>
  ): Promise<EmailLog | undefined> {
    const [updated] = await db
      .update(emailLogs)
      .set({
        ...updates,
        canceledAt: null,
      })
      .where(
        and(
          eq(emailLogs.id, emailLogId),
          eq(emailLogs.userId, userId),
          eq(emailLogs.status, "draft")
        )
      )
      .returning();

    return updated;
  }

  async cancelScheduledEmail(userId: string, emailLogId: string): Promise<EmailLog | undefined> {
    const [updated] = await db
      .update(emailLogs)
      .set({
        status: "canceled",
        canceledAt: new Date(),
      })
      .where(
        and(
          eq(emailLogs.id, emailLogId),
          eq(emailLogs.userId, userId),
          eq(emailLogs.status, "scheduled"),
          isNull(emailLogs.sentAt)
        )
      )
      .returning();

    return updated;
  }
}

export const storage = new DatabaseStorage();
