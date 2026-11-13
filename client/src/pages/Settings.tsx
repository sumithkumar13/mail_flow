import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Server, AlertTriangle, Brain } from "lucide-react";

export default function Settings() {
  const { user, setUser } = useStore();
  const { toast } = useToast();
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAI, setIsSavingAI] = useState(false);

  useEffect(() => {
    if (user) {
      setSmtpHost(user.smtpHost || "smtp.gmail.com");
      setSmtpPort(user.smtpPort || "587");
      setSmtpUser(user.smtpUser || user.email);
      setSmtpPass(user.smtpPassword || "");
      setGroqApiKey(user.groqApiKey || "");
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      toast({ 
        title: "Error", 
        description: "Please fill in all SMTP fields", 
        variant: "destructive" 
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await api.updateSmtp({
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword: smtpPass,
      });
      
      setUser(updatedUser);
      toast({ 
        title: "Settings Saved", 
        description: "Your SMTP credentials have been securely updated." 
      });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAI = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groqApiKey) {
      toast({ 
        title: "Error", 
        description: "Please enter your Groq API key", 
        variant: "destructive" 
      });
      return;
    }

    setIsSavingAI(true);
    try {
      const updatedUser = await api.updateAI({
        groqApiKey,
      });
      
      setUser(updatedUser);
      toast({ 
        title: "AI Settings Saved", 
        description: "Your Groq configuration has been updated." 
      });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSavingAI(false);
    }
  };

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your email delivery services</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                Gmail SMTP Configuration
              </CardTitle>
              <CardDescription>
                Connect your Gmail account using an App Password (not your regular password)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">SMTP Host</Label>
                    <Input 
                      id="host" 
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="bg-secondary/30 border-white/5"
                      data-testid="input-smtp-host"
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input 
                      id="port" 
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="bg-secondary/30 border-white/5"
                      data-testid="input-smtp-port"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Email Address</Label>
                  <Input 
                    id="username" 
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="bg-secondary/30 border-white/5"
                    data-testid="input-smtp-user"
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Gmail App Password</Label>
                  <Input 
                    id="password" 
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="bg-secondary/30 border-white/5"
                    data-testid="input-smtp-password"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Generate an App Password at: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline text-primary">Google Account Settings</a>
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="bg-primary hover:bg-primary/90"
                  data-testid="button-save-smtp"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Configuration"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                AI Email Generation
              </CardTitle>
              <CardDescription>
                Configure Groq to generate email content with AI (Fast & Free)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveAI} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="groq-api-key">Groq API Key</Label>
                  <Input 
                    id="groq-api-key" 
                    type="password"
                    value={groqApiKey}
                    onChange={(e) => setGroqApiKey(e.target.value)}
                    placeholder="gsk_..."
                    className="bg-secondary/30 border-white/5"
                    disabled={isSavingAI}
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your free API key at: <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="underline text-primary">Groq Console</a>
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={isSavingAI}
                >
                  {isSavingAI ? "Saving..." : "Save AI Configuration"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-yellow-500/20 bg-yellow-500/5 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-500">
                <AlertTriangle className="w-5 h-5" />
                How to Get App Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="text-sm text-yellow-200/80 leading-relaxed space-y-2 list-decimal list-inside">
                <li>Enable 2-Step Verification on your Google Account</li>
                <li>Visit Google Account App Passwords page</li>
                <li>Create a new app password for "Mail"</li>
                <li>Copy the 16-character password</li>
                <li>Paste it in the field above</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
