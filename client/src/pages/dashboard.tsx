import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, FileText, DollarSign } from "lucide-react";
import type { Customer, Route, Invoice } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  
  const { data: customers, isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: routes, isLoading: loadingRoutes } = useQuery<Route[]>({
    queryKey: ["/api/routes/today"],
  });

  const { data: invoices, isLoading: loadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const activeCustomers = customers?.filter(c => c.status === "active").length || 0;
  const todayRoutes = routes?.length || 0;
  const unpaidInvoices = invoices?.filter(inv => inv.status === "unpaid").length || 0;
  const totalRevenue = invoices
    ?.filter(inv => inv.status === "paid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0) || 0;

  const stats = [
    {
      title: "Active Customers",
      value: activeCustomers,
      icon: Users,
      description: "Currently serviced",
      gradient: "from-[#00BCD4] to-[#FF6F00]",
      testId: "stat-customers",
      link: "/customers"
    },
    {
      title: "Today's Routes",
      value: todayRoutes,
      icon: MapPin,
      description: "Scheduled for today",
      gradient: "from-[#FF6F00] to-[#00BCD4]",
      testId: "stat-routes",
      link: "/routes"
    },
    {
      title: "Unpaid Invoices",
      value: unpaidInvoices,
      icon: FileText,
      description: "Awaiting payment",
      gradient: "from-[#00BCD4] to-[#FF6F00]",
      testId: "stat-invoices",
      link: "/invoices?filter=unpaid"
    },
    {
      title: "Total Revenue",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      description: "All-time earnings",
      gradient: "from-[#FF6F00] to-[#00BCD4]",
      testId: "stat-revenue",
      link: "/invoices?filter=paid"
    },
  ];

  const isLoading = loadingCustomers || loadingRoutes || loadingInvoices;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent" data-testid="title-dashboard">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your business overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card 
            key={stat.title} 
            className="hover-elevate active-elevate-2 cursor-pointer" 
            data-testid={stat.testId}
            onClick={() => setLocation(stat.link)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${stat.gradient} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Routes</CardTitle>
            <CardDescription>Latest scheduled services</CardDescription>
          </CardHeader>
          <CardContent>
            {routes && routes.length > 0 ? (
              <div className="space-y-2">
                {routes.slice(0, 5).map((route) => {
                  const customer = customers?.find(c => c.id === route.customerId);
                  return (
                    <div
                      key={route.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`route-${route.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center text-white text-xs font-semibold">
                          {route.orderIndex + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{customer?.name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{customer?.address}</p>
                        </div>
                      </div>
                      <div className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                        {route.status}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No routes scheduled yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Latest billing activity</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices && invoices.length > 0 ? (
              <div className="space-y-2">
                {invoices.slice(0, 5).map((invoice) => {
                  const customer = customers?.find(c => c.id === invoice.customerId);
                  return (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`invoice-${invoice.id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{customer?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">#{invoice.invoiceNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">${parseFloat(invoice.amount).toFixed(2)}</p>
                        <div className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${
                          invoice.status === "paid" 
                            ? "bg-green-100 text-green-800" 
                            : invoice.status === "overdue"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {invoice.status}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No invoices yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
