import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Admin from "@/pages/Admin";
import Settings from "@/pages/Settings";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

function Router() {
  const { user, setUser } = useStore();
  const [location, setLocation] = useLocation();
  const [isUserLoaded, setIsUserLoaded] = useState(false);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await api.getMe();
        setUser(currentUser);
      } catch (error) {
        // Not logged in, ignore
      } finally {
        setIsUserLoaded(true);
      }
    };
    loadUser();
  }, [setUser]);

  // Simple route protection - only after user load is complete
  useEffect(() => {
    if (!isUserLoaded) return;
    
    if (!user && (location.startsWith('/dashboard') || location.startsWith('/admin') || location.startsWith('/settings'))) {
      setLocation('/auth');
    }
    if (user?.role !== 'admin' && location.startsWith('/admin')) {
      setLocation('/dashboard');
    }
  }, [user, location, setLocation, isUserLoaded]);

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/auth" component={Auth} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/campaigns" component={Dashboard} />
        <Route path="/settings" component={Settings} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
