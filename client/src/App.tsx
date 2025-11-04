import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationsBadge } from "@/components/notifications-badge";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Routes from "@/pages/routes";
import Messages from "@/pages/messages";
import Invoices from "@/pages/invoices";
import Reports from "@/pages/reports";
import Import from "@/pages/import";
import PriceBook from "@/pages/price-book";
import Settings from "@/pages/settings";
import CustomerPortal from "@/pages/customer-portal";
import Bookings from "@/pages/bookings";
import BookNow from "@/pages/book";
import ReviewPage from "@/pages/review";
import ReviewsPage from "@/pages/reviews";
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
      <Route path="/settings" component={Settings} />
      <Route path="/bookings" component={Bookings} />
      <Route path="/portal" component={CustomerPortal} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
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
              <div className="text-xs text-muted-foreground">
                Logged in as Admin
              </div>
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
      <TooltipProvider>
        <Switch>
          <Route path="/book" component={BookNow} />
          <Route path="/review/:token" component={ReviewPage} />
          <Route>
            <AdminLayout />
          </Route>
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
