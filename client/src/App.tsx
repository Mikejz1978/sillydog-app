import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationsBadge } from "@/components/notifications-badge";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Routes from "@/pages/routes";
import Messages from "@/pages/messages";
import Invoices from "@/pages/invoices";
import Reports from "@/pages/reports";
import Import from "@/pages/import";
import PriceBook from "@/pages/price-book";
import Settings from "@/pages/settings";
import Users from "@/pages/users";
import CustomerPortal from "@/pages/customer-portal";
import PortalLogin from "@/pages/portal-login";
import Bookings from "@/pages/bookings";
import BookNow from "@/pages/book";
import ReviewPage from "@/pages/review";
import ReviewsPage from "@/pages/reviews";
import PortalPreview from "@/pages/portal-preview";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/customers" component={Customers} />
      <Route path="/routes" component={Routes} />
      <Route path="/messages" component={Messages} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/reports" component={Reports} />
      <Route path="/reviews" component={ReviewsPage} />
      <Route path="/import" component={Import} />
      <Route path="/price-book" component={PriceBook} />
      <Route path="/users" component={Users} />
      <Route path="/settings" component={Settings} />
      <Route path="/bookings" component={Bookings} />
      <Route path="/portal-preview" component={PortalPreview} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminLayout() {
  const { user, logout, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-4">
              <NotificationsBadge />
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {user.firstName || user.email}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {user.role}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
                <span className="ml-2">Logout</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/book" component={BookNow} />
            <Route path="/review/:token" component={ReviewPage} />
            <Route path="/portal/login" component={PortalLogin} />
            <Route path="/portal" component={CustomerPortal} />
            <Route>
              <AdminLayout />
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
