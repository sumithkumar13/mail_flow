import Groq from "groq-sdk";
import type { User } from "@shared/schema";

function looksLikeHtml(input: string) {
  return /<\s*\/?\s*[a-z][\s\S]*?>/i.test(input);
}

function htmlToText(html: string) {
  return html
    .replace(/\r\n?/g, "\n")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*p(\s[^>]*)?>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function generateEmailContent(
  user: User,
  prompt: string
): Promise<{ subject: string; message: string; messageHtml?: string }> {
  if (!user.groqApiKey) {
    throw new Error("Groq API key not configured. Please add it in Settings.");
  }

  const groq = new Groq({ apiKey: user.groqApiKey });

  try {
    const fullPrompt = `Write a professional email based on this request: ${prompt}

Please format your response EXACTLY as:
Subject: [write a clear email subject line]
Body: [write the complete email body in HTML format using EXACTLY 3 blocks:
1) A greeting block in a single <p> (e.g. "Dear X," or "Hello X,")
2) ONE body block in a single <p> (do NOT split the body into multiple <p> tags and do NOT insert extra blank lines)
3) A closing block in a single <p> (e.g. "Best regards,<br>Your Name")

Use <br> ONLY inside the closing block for the signature line.]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: fullPrompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1024,
    });

    const text = chatCompletion.choices[0]?.message?.content || "";

    // Parse the response to extract subject and body
    const subjectMatch = text.match(/Subject:\s*(.+?)(?:\n|$)/i);
    const bodyMatch = text.match(/Body:\s*([\s\S]+?)$/i);

    if (subjectMatch && bodyMatch) {
      const rawBody = bodyMatch[1].trim();
      const messageHtml = looksLikeHtml(rawBody) ? rawBody : undefined;
      return {
        subject: subjectMatch[1].trim(),
        message: messageHtml ? htmlToText(messageHtml) : rawBody,
        messageHtml,
      };
    }

    // Fallback parsing - try to split by lines
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length >= 2) {
      return {
        subject: lines[0].replace(/^(subject:|Subject:)\s*/i, "").trim(),
        message: lines.slice(1).join("\n").trim(),
      };
    }

    // Last resort - use prompt as subject and response as body
    return {
      subject: prompt.slice(0, 100),
      message: text.trim(),
    };
  } catch (error: any) {
    console.error("Groq API error:", error);
    throw new Error(`Failed to generate email: ${error.message}`);
  }
}
