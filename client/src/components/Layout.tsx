import { Link, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { LayoutDashboard, LogOut, Mail, Users, Shield, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useStore();

  const isLanding = location === "/" || location === "/auth";

  if (isLanding) {
    return <div className="min-h-screen bg-background text-foreground font-sans">{children}</div>;
  }

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", show: user?.role === 'user' },
    { icon: Settings, label: "Settings", href: "/settings", show: user?.role === 'user' },
    { icon: Shield, label: "Admin", href: "/admin", show: user?.role === 'admin' },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            MailFlow
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {navItems.filter(item => item.show).map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group cursor-pointer",
                location === item.href 
                  ? "bg-sidebar-primary/10 text-sidebar-primary font-medium" 
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
                <item.icon className={cn("w-5 h-5", location === item.href ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
                {item.label}
              </div>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.name?.[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
