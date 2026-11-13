import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import { useStore } from "@/lib/store";
import { api, type EmailLog } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Send, History, AlertCircle, Sparkles, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AttachmentPayload } from "@shared/types";

export default function Dashboard() {
  const { user } = useStore();
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  const attachmentInputSingleRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputBulkRef = useRef<HTMLInputElement | null>(null);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [messageHtml, setMessageHtml] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [composeTab, setComposeTab] = useState<'single' | 'bulk'>('single');
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleDeleteDraft = async (id: string) => {
    try {
      await api.deleteDraft(id);
      toast({
        title: "Draft removed",
        description: "The draft has been deleted.",
      });
      void loadLogs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const loadLogs = useCallback(async () => {
    try {
      const logs = await api.getEmailLogs();
      if (!isMountedRef.current) return;
      setEmailLogs(logs);
    } catch (error: any) {
      console.error("Failed to load logs:", error);
    } finally {
      if (!isMountedRef.current) return;
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearAttachmentInputs = () => {
    // Clearing is important so selecting the same file again re-triggers onChange.
    if (attachmentInputSingleRef.current) attachmentInputSingleRef.current.value = "";
    if (attachmentInputBulkRef.current) attachmentInputBulkRef.current.value = "";

    // Most robust reset: force a brand-new DOM <input type="file">.
    // This avoids browser quirks where clearing `.value` is not enough.
    setAttachmentInputKey((value) => value + 1);
  };

  const appendAttachments = (files: File[]) => {
    if (!files.length) return;

    setAttachments((prev) => [...prev, ...files]);
    toast({
      title: "Attachments added",
      description: `${files.length} file(s) added`,
    });
    clearAttachmentInputs();
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    appendAttachments(selectedFiles);
    event.currentTarget.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
    toast({
      title: "Attachment removed",
      description: "You can attach again now.",
    });
    clearAttachmentInputs();
  };

  const prepareAttachmentsPayloads = async (): Promise<AttachmentPayload[]> => {
    return Promise.all(
      attachments.map(
        (file) =>
          new Promise<AttachmentPayload>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== "string") {
                reject(new Error("Failed to read attachment"));
                return;
              }
              resolve({
                filename: file.name,
                mimeType: file.type || undefined,
                data: reader.result,
              });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    );
  };

  const handleGenerateAI = async () => {
    if (!prompt) {
      toast({ title: "Error", description: "Please enter a prompt", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await api.generateEmail(prompt);
      setSubject(result.subject);
      // Keep Dashboard display readable: collapse excessive blank lines while
      // preserving one blank line between greeting/body/closing.
      const normalizedMessage = result.message
        .replace(/\r\n?/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      setMessage(normalizedMessage);
      setMessageHtml(result.messageHtml || null);
      toast({ title: "Success", description: "Email content generated with AI!" });
      setPrompt(""); // Clear prompt after successful generation
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async (type: 'single' | 'bulk') => {
    if (!subject || !message || !recipient) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const attachmentPayloads = attachments.length ? await prepareAttachmentsPayloads() : undefined;

      if (type === 'single') {
        await api.sendEmail({
          recipient,
          subject,
          message,
          messageHtml: messageHtml || undefined,
          scheduledAt: scheduledAt || undefined,
          attachments: attachmentPayloads,
          draftId: draftId || undefined,
        });
        const scheduleMsg = scheduledAt ? " and scheduled" : " sent";
        toast({ title: "Success", description: `Email${scheduleMsg} successfully` });
      } else {
        const result = await api.sendBulkEmail({
          recipients: recipient,
          subject,
          message,
          messageHtml: messageHtml || undefined,
          scheduledAt: scheduledAt || undefined,
          attachments: attachmentPayloads,
          draftId: draftId || undefined,
        });
        toast({ 
          title: "Bulk Send Complete", 
          description: result.message 
        });
      }
      
      // Reset form, attachments, and reload logs
      setRecipient("");
      setSubject("");
      setMessage("");
      setMessageHtml(null);
      setScheduledAt("");
      setAttachments([]);
      setDraftId(null);
      clearAttachmentInputs();
      // Don't keep the UI in a "sending" state while logs refresh (especially
      // when logs include attachment metadata).
      void loadLogs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    const hasAnyContent = Boolean(recipient.trim() || subject.trim() || message.trim());
    if (!hasAnyContent) {
      toast({
        title: "Draft is empty",
        description: "Add at least a recipient, subject, or message.",
        variant: "destructive",
      });
      return;
    }

    try {
      const wasUpdating = Boolean(draftId);
      const attachmentPayloads = attachments.length ? await prepareAttachmentsPayloads() : undefined;
      const isBulk = composeTab === 'bulk';

      const res = draftId
        ? await api.updateDraft(draftId, {
            type: isBulk ? 'bulk' : 'single',
            recipient: isBulk ? undefined : recipient,
            recipients: isBulk ? recipient : undefined,
            subject,
            message,
            messageHtml: messageHtml || undefined,
            attachments: attachmentPayloads,
          })
        : await api.saveDraft({
            type: isBulk ? 'bulk' : 'single',
            recipient: isBulk ? undefined : recipient,
            recipients: isBulk ? recipient : undefined,
            subject,
            message,
            messageHtml: messageHtml || undefined,
            attachments: attachmentPayloads,
          });

      // After saving (new or update), reset the composer so the user can immediately
      // start a new email. The draft remains available in the Drafts panel.
      setDraftId(null);
      setRecipient('');
      setSubject('');
      setMessage('');
      setMessageHtml(null);
      setScheduledAt('');
      setAttachments([]);
      clearAttachmentInputs();
      toast({
        title: wasUpdating ? "Draft updated" : "Draft saved",
        description: "Saved. Composer cleared so you can write a new email.",
      });
      void loadLogs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleLoadDraft = (log: EmailLog) => {
    setComposeTab(log.type);
    if (log.type === 'bulk') {
      const recipientsText = (() => {
        if (!log.recipients) return '';
        try {
          const parsed = JSON.parse(log.recipients);
          if (Array.isArray(parsed)) return parsed.join("\n");
        } catch {
          // Fall back to whatever is stored.
        }
        return log.recipients;
      })();

      setRecipient(recipientsText);
    } else {
      setRecipient(log.recipient || '');
    }

    const normalizeDraftMessage = (raw: string) => {
      if (!raw) return '';

      // If the stored message looks like HTML, convert it to readable plain text.
      // We explicitly preserve formatting:
      // - <p> blocks become blank-line separated paragraphs
      // - <br> becomes a newline
      if (!raw.includes('<')) return raw;

      try {
        let text = raw.replace(/\r\n?/g, "\n");
        text = text.replace(/<\s*br\s*\/?\s*>/gi, "\n");
        text = text.replace(/<\s*\/\s*p\s*>\s*<\s*p\s*>/gi, "\n\n");
        text = text.replace(/<\s*p\b[^>]*>/gi, "");
        text = text.replace(/<\s*\/\s*p\s*>/gi, "");
        text = text.replace(/<[^>]+>/g, "");

        // Decode HTML entities (e.g. &nbsp;, &amp;)
        const decoder = document.createElement('textarea');
        decoder.innerHTML = text;
        text = decoder.value;

        return text.replace(/\n{3,}/g, "\n\n").trim();
      } catch {
        return raw.replace(/<[^>]*>/g, '').trim();
      }
    };

    setSubject(log.subject || '');
    setMessage(normalizeDraftMessage(log.message || ''));
    setMessageHtml(null);
    setScheduledAt('');
    setDraftId(log.id);
    setAttachments([]);
    clearAttachmentInputs();

    toast({
      title: "Draft loaded",
      description: log.attachments?.length
        ? "Draft loaded. Please re-attach files before sending (attachments can’t be restored into the file picker)."
        : "Draft loaded into the editor.",
    });
  };

  const handleCancelScheduled = async (id: string) => {
    setCancelingId(id);
    try {
      await api.cancelScheduledEmail(id);
      toast({
        title: "Canceled",
        description: "Scheduled email has been canceled.",
      });
      void loadLogs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCancelingId((current) => (current === id ? null : current));
    }
  };

  const hasSmtpConfig = user?.smtpHost && user?.smtpUser;
  const hasAIConfig = user?.groqApiKey;
  const hasPendingEmails = emailLogs.some((log) =>
    log.status === "scheduled" || log.status === "queued" || log.status === "sending"
  );
  const drafts = emailLogs.filter((log) => log.status === 'draft');
  const recentNonDraftLogs = emailLogs.filter((log) => log.status !== 'draft');

  useEffect(() => {
    // Scheduled emails are sent in the background (server cron). Keep the UI in sync
    // without requiring a manual page refresh.
    if (!hasPendingEmails) return;

    const intervalId = window.setInterval(() => {
      void loadLogs();
    }, 10_000);

    const onFocus = () => {
      void loadLogs();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [hasPendingEmails, loadLogs]);

  const renderAttachmentsField = (tab: 'single' | 'bulk') => (
    <div className="space-y-2">
      <Label>Attachments</Label>
      <div
        className="rounded-md border border-dashed border-white/10 bg-secondary/10 p-3"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = Array.from(e.dataTransfer.files || []);
          appendAttachments(dropped);
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isSending}
            onClick={() => {
              const ref = tab === 'single' ? attachmentInputSingleRef : attachmentInputBulkRef;
              ref.current?.click();
            }}
          >
            Add files
          </Button>

          <span className="text-xs text-muted-foreground">
            {attachments.length ? `${attachments.length} file(s) selected` : "No files selected"}
          </span>

          {attachments.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              disabled={isSending}
              onClick={() => {
                setAttachments([]);
                toast({
                  title: "Attachments cleared",
                  description: "You can attach again now.",
                });
                clearAttachmentInputs();
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <input
          key={`${tab}-${attachmentInputKey}`}
          ref={tab === 'single' ? attachmentInputSingleRef : attachmentInputBulkRef}
          type="file"
          multiple
          onChange={handleAttachmentChange}
          disabled={isSending}
          className="hidden"
          data-testid="input-attachments"
        />

        <p className="mt-2 text-xs text-muted-foreground">Tip: you can also drag & drop files here.</p>
      </div>
      {attachments.length > 0 ? (
        <div className="space-y-1">
          {attachments.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded border border-white/10 bg-secondary/10 px-3 py-1 text-xs text-muted-foreground"
            >
              <span className="truncate mr-2">{file.name} · {formatFileSize(file.size)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => removeAttachment(index)}
                data-testid={`attachment-remove-${index}`}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Attach files to include them in this send.</p>
      )}
    </div>
  );

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Compose and track your email campaigns</p>
        </div>
      </div>

      {!hasSmtpConfig && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200">
            SMTP credentials not configured. Please visit <a href="/settings" className="underline font-medium">Settings</a> to configure your Gmail SMTP before sending emails.
          </AlertDescription>
        </Alert>
      )}

      {!hasAIConfig && (
        <Alert className="border-purple-500/50 bg-purple-500/10">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <AlertDescription className="text-purple-200">
            AI features are not configured. Please visit <a href="/settings" className="underline font-medium">Settings</a> to add your AI provider API key.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {hasAIConfig && (
            <Card className="border-purple-500/50 bg-purple-500/5 backdrop-blur-sm mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  AI Email Generator
                </CardTitle>
                <CardDescription>Describe what you want to send, and AI will write it for you</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>What do you want to say?</Label>
                    <Textarea 
                      placeholder="E.g., Write a professional email to thank a client for their business..." 
                      className="min-h-[100px] bg-secondary/30 border-purple-500/20"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                    />
                  </div>
                  <Button 
                    onClick={handleGenerateAI}
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={isGenerating || !prompt}
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Compose Email</CardTitle>
              <CardDescription>Send using Gmail SMTP</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={composeTab}
                onValueChange={(value) => setComposeTab(value as 'single' | 'bulk')}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50">
                  <TabsTrigger value="single" data-testid="tab-single">Single Email</TabsTrigger>
                  <TabsTrigger value="bulk" data-testid="tab-bulk">Bulk Sender</TabsTrigger>
                </TabsList>

                <TabsContent value="single" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Recipient Email</Label>
                    <Input 
                      placeholder="client@example.com" 
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="bg-secondary/30 border-white/5"
                      data-testid="input-recipient"
                      disabled={isSending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input 
                      placeholder="Important Update..." 
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="bg-secondary/30 border-white/5"
                      data-testid="input-subject"
                      disabled={isSending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Schedule Send (Optional)</Label>
                    <Input 
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="bg-secondary/30 border-white/5"
                      data-testid="input-schedule"
                      disabled={isSending}
                    />
                    <p className="text-xs text-muted-foreground">Leave empty to send immediately</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea 
                      placeholder="Type your message here..." 
                      className="min-h-[200px] bg-secondary/30 border-white/5"
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        // If the user edits the content manually, treat it as plain text.
                        setMessageHtml(null);
                      }}
                      data-testid="textarea-message"
                      disabled={isSending}
                    />
                  </div>
                  {composeTab === 'single' ? renderAttachmentsField('single') : null}
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90" 
                    onClick={() => handleSend('single')}
                    disabled={isSending || !hasSmtpConfig}
                    data-testid="button-send"
                  >
                    {isSending ? "Sending..." : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {scheduledAt ? "Schedule Email" : "Send Email"}
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => void handleSaveDraft()}
                    disabled={isSending}
                    data-testid="button-save-draft"
                  >
                    {draftId ? "Update Draft" : "Save Draft"}
                  </Button>
                </TabsContent>

                <TabsContent value="bulk" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Recipient List</Label>
                    <Textarea 
                      placeholder="Enter emails separated by commas or new lines...&#10;john@example.com&#10;jane@company.com" 
                      className="min-h-[120px] bg-secondary/30 border-white/5 font-mono text-sm"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      data-testid="textarea-bulk-recipients"
                      disabled={isSending}
                    />
                    <p className="text-xs text-muted-foreground">Enter manually. No CSV upload required.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Subject for All</Label>
                    <Input 
                      placeholder="Newsletter Subject..." 
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="bg-secondary/30 border-white/5"
                      data-testid="input-bulk-subject"
                      disabled={isSending}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Schedule Send (Optional)</Label>
                    <Input 
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="bg-secondary/30 border-white/5"
                      data-testid="input-bulk-schedule"
                      disabled={isSending}
                    />
                    <p className="text-xs text-muted-foreground">Leave empty to send immediately</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Message Template</Label>
                    <Textarea 
                      placeholder="Type your message here..." 
                      className="min-h-[150px] bg-secondary/30 border-white/5"
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        setMessageHtml(null);
                      }}
                      data-testid="textarea-bulk-message"
                      disabled={isSending}
                    />
                  </div>
                  {composeTab === 'bulk' ? renderAttachmentsField('bulk') : null}

                  <Button 
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={() => handleSend('bulk')}
                    disabled={isSending || !hasSmtpConfig}
                    data-testid="button-send-bulk"
                  >
                    {isSending ? "Processing..." : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {scheduledAt ? "Schedule Bulk Campaign" : "Start Bulk Campaign"}
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => void handleSaveDraft()}
                    disabled={isSending}
                    data-testid="button-save-draft-bulk"
                  >
                    {draftId ? "Update Draft" : "Save Draft"}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isLoadingLogs ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
                ) : drafts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No drafts yet</p>
                ) : (
                  drafts.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between rounded-lg bg-secondary/30 border border-white/5 p-3"
                      data-testid={`draft-${log.id}`}
                    >
                      <div className="overflow-hidden">
                        <p className="font-medium truncate text-sm">{log.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">{log.recipient}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleLoadDraft(log)}
                          disabled={isSending}
                          data-testid={`draft-edit-${log.id}`}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDeleteDraft(log.id)}
                          disabled={isSending}
                          data-testid={`draft-delete-${log.id}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoadingLogs ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
                ) : recentNonDraftLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No emails sent yet</p>
                ) : (
                  recentNonDraftLogs.slice(0, 5).map((log) => {
                    const displayStatus = log.status === 'queued' ? 'sending' : log.status;

                    return (
                      <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-white/5" data-testid={`log-${log.id}`}>
                        <div className="overflow-hidden">
                          <p className="font-medium truncate text-sm">{log.subject}</p>
                          <p className="text-xs text-muted-foreground truncate">{log.recipient}</p>
                          {log.status === 'failed' && log.error ? (
                            <p className="text-xs text-red-400 mt-1 line-clamp-2">Error: {log.error}</p>
                          ) : null}
                          {log.status === 'partial' && log.error ? (
                            <p className="text-xs text-yellow-300/90 mt-1 line-clamp-2">Partial: {log.error}</p>
                          ) : null}
                          {log.scheduledAt && log.status === 'scheduled' && (
                            <p className="text-xs text-blue-400 mt-1">
                              Scheduled: {new Date(log.scheduledAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            displayStatus === 'sent' ? 'bg-green-500/20 text-green-400' : 
                            displayStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
                            displayStatus === 'sending' ? 'bg-purple-500/20 text-purple-300' :
                            displayStatus === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                            displayStatus === 'canceled' ? 'bg-zinc-500/20 text-zinc-300' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`} data-testid={`status-${displayStatus}`}>
                            {displayStatus}
                          </span>

                          {log.status === 'scheduled' ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => void handleCancelScheduled(log.id)}
                              disabled={cancelingId === log.id}
                              data-testid={`cancel-${log.id}`}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              {cancelingId === log.id ? 'Canceling...' : 'Cancel'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
