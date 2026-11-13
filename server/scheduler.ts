import cron from "node-cron";
import { db } from "./db";
import { emailLogs, users } from "@shared/schema";
import { eq, and, lte, isNull, sql } from "drizzle-orm";
import { sendEmail, sendBulkEmails } from "./email";
import { parseAttachmentPayloadsFromColumn, createMailerAttachments } from "./attachment-utils";

// Check for scheduled emails every minute
export function startEmailScheduler() {
  console.log("📅 Email scheduler started - checking every minute");

  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      
      // Find all emails scheduled to be sent now or in the past, but not yet sent
      const scheduledEmails = await db
        .select()
        .from(emailLogs)
        .where(
          and(
            lte(emailLogs.scheduledAt, now),
            eq(emailLogs.status, "scheduled"),
            isNull(emailLogs.sentAt)
          )
        );

      if (scheduledEmails.length > 0) {
        console.log(`📧 Found ${scheduledEmails.length} scheduled emails to send`);
      }

      for (const log of scheduledEmails) {
        try {
          // Avoid race: allow the user to cancel even if it was selected by the cron tick.
          const [latest] = await db
            .select({ status: emailLogs.status })
            .from(emailLogs)
            .where(eq(emailLogs.id, log.id));

          if (!latest || latest.status !== "scheduled") {
            continue;
          }

          // Claim this scheduled email so overlapping cron ticks don't process it twice.
          // Bulk sends can take > 1 minute; without a claim step, the next tick can pick it up again.
          const claimed = await db
            .update(emailLogs)
            .set({ status: "sending", error: null })
            .where(and(eq(emailLogs.id, log.id), eq(emailLogs.status, "scheduled"), isNull(emailLogs.sentAt)))
            .returning({ id: emailLogs.id });

          if (!claimed.length) {
            continue;
          }

          // Get user for SMTP credentials
          const [user] = await db.select().from(users).where(eq(users.id, log.userId));
          const attachmentPayloads = parseAttachmentPayloadsFromColumn(log.attachments);
          const scheduledAttachments = createMailerAttachments(attachmentPayloads);
          
          if (!user) {
            console.error(`User ${log.userId} not found for email ${log.id}`);
            await db
              .update(emailLogs)
              .set({ status: "failed" })
              .where(eq(emailLogs.id, log.id));
            continue;
          }

          // Check if user has SMTP configured
          if (!user.smtpHost || !user.smtpUser) {
            console.error(`User ${user.email} does not have SMTP configured`);
            await db
              .update(emailLogs)
              .set({ status: "failed" })
              .where(eq(emailLogs.id, log.id));
            continue;
          }

          console.log(`Sending scheduled email: ${log.subject} to ${log.recipient}`);

          // Handle bulk vs single email
          if (log.type === "bulk") {
            if (!log.recipients) {
              throw new Error("Scheduled bulk email is missing stored recipients");
            }

            let recipientList: string[];
            try {
              recipientList = JSON.parse(log.recipients);
            } catch {
              throw new Error("Scheduled bulk email has invalid recipients format");
            }

            if (!Array.isArray(recipientList) || recipientList.length === 0) {
              throw new Error("Scheduled bulk email has no valid recipients");
            }

            const results = await sendBulkEmails(
              user,
              recipientList,
              log.subject,
              log.message,
              scheduledAttachments
            );

            const status = results.failed === 0 ? "sent" : results.sent > 0 ? "partial" : "failed";
            const errorSummary = results.failed
              ? results.errors.slice(0, 5).join("\n")
              : null;
            await db
              .update(emailLogs)
              .set({
                status,
                sentAt: results.sent > 0 ? new Date() : null,
                error: errorSummary,
              })
              .where(eq(emailLogs.id, log.id));

            if (results.sent > 0) {
              await db
                .update(users)
                .set({ emailsSent: sql`${users.emailsSent} + ${results.sent}` })
                .where(eq(users.id, user.id));
            }

            console.log(
              `✅ Scheduled bulk send completed: ${log.id} (sent=${results.sent}, failed=${results.failed})`
            );
          } else {
            // Send single email
            await sendEmail(user, {
              to: log.recipient,
              subject: log.subject,
              text: log.message,
              // Match bulk behavior: always provide an html body as well.
              // This avoids edge cases where some clients/providers behave differently
              // for scheduled single sends (especially when attachments are present).
              html: log.message,
              attachments: scheduledAttachments,
            });

            // Update status to sent
            await db
              .update(emailLogs)
              .set({ 
                status: "sent", 
                sentAt: new Date(),
                error: null,
              })
              .where(eq(emailLogs.id, log.id));

            // Update user's email count
            await db
              .update(users)
              .set({ emailsSent: user.emailsSent + 1 })
              .where(eq(users.id, user.id));

            console.log(`✅ Scheduled email sent successfully: ${log.id}`);
          }
        } catch (error: any) {
          const message = error?.message ? String(error.message) : String(error);
          console.error(`Failed to send scheduled email ${log.id}:`, error);
          await db
            .update(emailLogs)
            .set({ status: "failed", error: message })
            .where(eq(emailLogs.id, log.id));
        }
      }
    } catch (error) {
      console.error("Error in email scheduler:", error);
    }
  });
}
