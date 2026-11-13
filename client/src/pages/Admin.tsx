import { useMemo, useState, useEffect } from "react";
import { api, type User, type EmailLog } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, Mail, Calendar, Eye } from "lucide-react";

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [logQuery, setLogQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUserLogsOpen, setIsUserLogsOpen] = useState(false);
  const [userLogQuery, setUserLogQuery] = useState("");

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersData, logsData] = await Promise.all([
        api.getAllUsers(),
        api.getAllLogs(),
      ]);
      setUsers(usersData);
      setEmailLogs(logsData);
    } catch (error: any) {
      console.error("[Admin] Failed to load data:", error);
      console.error("[Admin] Error details:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (value?: string) => {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const logWhen = (log: EmailLog) => log.sentAt ?? log.scheduledAt ?? log.createdAt;
  const shouldHideLog = (log: EmailLog) => log.status === 'failed' || log.status === 'queued';

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const totalSent = users.reduce((acc, user) => acc + user.emailsSent, 0);
  const scheduledEmails = emailLogs.filter((l) => l.status === 'scheduled').length;

  const openLog = (log: EmailLog) => {
    setSelectedLog(log);
    setIsLogOpen(true);
  };

  const openUserLogs = (userId: string) => {
    setSelectedUserId(userId);
    setUserLogQuery("");
    setIsUserLogsOpen(true);
  };

  const formatRecipients = (log: EmailLog) => {
    if (log.type === 'bulk' && log.recipients) {
      try {
        const parsed = JSON.parse(log.recipients);
        if (Array.isArray(parsed)) return parsed.join(", ");
      } catch {
        // ignore
      }
    }
    return log.recipient;
  };

  const statusVariant = (status: EmailLog['status']) => {
    switch (status) {
      case 'sent':
        return "default";
      case 'failed':
        return "destructive";
      case 'scheduled':
        return "secondary";
      case 'partial':
        return "outline";
      default:
        return "secondary";
    }
  };

  const chartData = users.map(user => ({
    name: user.name.split(' ')[0],
    emails: user.emailsSent
  }));

  const normalizedUserQuery = userQuery.trim().toLowerCase();
  const filteredUsers = normalizedUserQuery
    ? users.filter((u) =>
        `${u.name} ${u.email}`.toLowerCase().includes(normalizedUserQuery)
      )
    : users;

  const normalizedLogQuery = logQuery.trim().toLowerCase();

const filteredEmailLogs = (
  normalizedLogQuery
    ? emailLogs.filter((log) => {
        const user = usersById.get(log.userId);
        const to = formatRecipients(log);
        const haystack = [
          user?.name,
          user?.email,
          to,
          log.subject,
          log.status,
          log.type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedLogQuery);
      })
    : emailLogs
)
  // Hide noisy/misleading statuses from admin activity.
  .filter((log) => !shouldHideLog(log))
  // newest first
  .sort(
    (a, b) =>
      new Date(logWhen(b)).getTime() - new Date(logWhen(a)).getTime()
  )
  // only latest 10
  .slice(0, 10);


  const selectedUser = selectedUserId ? usersById.get(selectedUserId) : null;
  const normalizedUserLogQuery = userLogQuery.trim().toLowerCase();
  const selectedUserLogs = selectedUserId
    ? emailLogs.filter((l) => l.userId === selectedUserId).filter((l) => !shouldHideLog(l))
    : [];
  const filteredSelectedUserLogs = normalizedUserLogQuery
    ? selectedUserLogs.filter((log) => {
        const to = formatRecipients(log);
        const haystack = [to, log.subject, log.status, log.type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedUserLogQuery);
      })
    : selectedUserLogs;

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Admin Portal</h1>
          <p className="text-muted-foreground">System overview and user management</p>
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            setIsLoading(true);
            void loadData();
          }}
          className="shrink-0"
        >
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "text-blue-400" },
          { label: "Total Emails Sent", value: totalSent, icon: Mail, color: "text-purple-400" },
          { label: "Scheduled Emails", value: scheduledEmails, icon: Calendar, color: "text-orange-400" },
        ].map((stat, i) => (
          <Card key={i} className="border-border/50 bg-card/50 backdrop-blur-sm" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                <p className="text-2xl font-bold font-display mt-1" data-testid={`value-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>{stat.value}</p>
              </div>
              <div className={`p-3 rounded-full bg-secondary/50 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* User Table */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-full">
            <CardHeader>
              <CardTitle>User Directory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  placeholder="Search users (name or email)"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="bg-secondary/30 border-white/5"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-white/5">
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Emails Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="border-white/5 hover:bg-white/5 cursor-pointer"
                      data-testid={`user-row-${user.id}`}
                      onClick={() => openUserLogs(user.id)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium" data-testid={`user-name-${user.id}`}>{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20" data-testid={`user-role-${user.id}`}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`user-emails-${user.id}`}>{user.emailsSent}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Activity Chart */}
        <div className="lg:col-span-1">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-full">
            <CardHeader>
              <CardTitle>Top Senders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    />
                    <Bar dataKey="emails" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'hsl(var(--primary))' : '#a855f7'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Email Activity */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Email Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search emails (user, recipient, subject, status)"
              value={logQuery}
              onChange={(e) => setLogQuery(e.target.value)}
              className="bg-secondary/30 border-white/5"
            />
          </div>

          {filteredEmailLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No email activity yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-white/5">
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmailLogs.map((log) => {
                  const user = usersById.get(log.userId);
                  const when = logWhen(log);
                  return (
                    <TableRow key={log.id} className="border-white/5 hover:bg-white/5" data-testid={`log-row-${log.id}`}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(when)}
                      </TableCell>
                      <TableCell>
                        <div className="leading-tight">
                          <button
                            type="button"
                            className="font-medium text-left hover:underline"
                            onClick={() => openUserLogs(log.userId)}
                            data-testid={`log-user-${log.id}`}
                          >
                            {user?.name ?? log.userId}
                          </button>
                          {user?.email ? (
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <p className="truncate" title={formatRecipients(log)}>{formatRecipients(log)}</p>
                      </TableCell>
                      <TableCell className="max-w-[340px]">
                        <p className="truncate font-medium" title={log.subject}>{log.subject}</p>
                        <p className="text-xs text-muted-foreground">{log.type === 'bulk' ? 'Bulk' : 'Single'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(log.status)} className="capitalize">
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openLog(log)}
                          data-testid={`log-view-${log.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sent Email</DialogTitle>
          </DialogHeader>

          {selectedLog ? (
            <div className="space-y-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Subject</p>
                    <p className="font-medium truncate" title={selectedLog.subject}>{selectedLog.subject}</p>
                  </div>
                  <Badge variant={statusVariant(selectedLog.status)} className="capitalize">
                    {selectedLog.status}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">From</p>
                    <p className="font-medium">
                      {usersById.get(selectedLog.userId)?.email ?? selectedLog.userId}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">To</p>
                    <p className="font-medium" style={{ wordBreak: 'break-word' }}>
                      {formatRecipients(selectedLog)}
                    </p>
                  </div>
                </div>

                {selectedLog.attachments && selectedLog.attachments.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Attachments</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside">
                      {selectedLog.attachments.map((attachment) => (
                        <li key={`${selectedLog.id}-${attachment.filename}`}>{attachment.filename}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {formatDateTime(selectedLog.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sent</p>
                    <p className="font-medium">
                      {formatDateTime(selectedLog.sentAt)}
                    </p>
                  </div>
                </div>
              </div>

              <ScrollArea className="h-[420px] rounded-md border border-border/60 p-4 bg-background/40">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                  {selectedLog.message}
                </pre>
              </ScrollArea>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isUserLogsOpen} onOpenChange={setIsUserLogsOpen}>
  <DialogContent className="w-[95vw] max-w-6xl max-h-[85vh] flex flex-col">
    <DialogHeader>
      <DialogTitle>
        {selectedUser
          ? `${selectedUser.name} — Sent Emails`
          : "User — Sent Emails"}
      </DialogTitle>
    </DialogHeader>

    {/* User email + search (fixed, no scroll) */}
    <div className="space-y-3">
      {selectedUser?.email && (
        <p className="text-sm text-muted-foreground">
          {selectedUser.email}
        </p>
      )}

      <Input
        placeholder="Search this user's emails (recipient, subject, status)"
        value={userLogQuery}
        onChange={(e) => setUserLogQuery(e.target.value)}
        className="bg-secondary/30 border-white/5"
      />
    </div>

    {/* ✅ ONLY THIS PART SCROLLS */}
    <div className="flex-1 overflow-y-auto mt-4 rounded-md border border-border/60">
      {filteredSelectedUserLogs.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No emails found for this user.
        </p>
      ) : (
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="border-white/5">
              <TableHead>When</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right whitespace-nowrap">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredSelectedUserLogs.map((log) => {
              const when = logWhen(log);

              return (
                <TableRow
                  key={log.id}
                  className="border-white/5 hover:bg-white/5"
                >
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(when)}
                  </TableCell>

                  <TableCell className="max-w-[360px] truncate">
                    {formatRecipients(log)}
                  </TableCell>

                  <TableCell className="max-w-[520px]">
                    <p className="truncate font-medium" title={log.subject}>
                      {log.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.type === "bulk" ? "Bulk" : "Single"}
                    </p>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={statusVariant(log.status)}
                      className="capitalize"
                    >
                      {log.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openLog(log)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  </DialogContent>
</Dialog>

    </div>
  );
}

