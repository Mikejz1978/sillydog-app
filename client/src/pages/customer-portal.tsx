import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, CreditCard, MapPin } from "lucide-react";
import type { Customer, Invoice, Route } from "@shared/schema";

// This is a simplified customer portal for demonstration
// In production, this would require customer authentication
export default function CustomerPortal() {
  // For demo purposes, we'll show data for the first customer
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: routes } = useQuery<Route[]>({
    queryKey: ["/api/routes/today"],
  });

  const customer = customers?.[0];
  const customerInvoices = invoices?.filter(inv => inv.customerId === customer?.id);
  const customerRoutes = routes?.filter(r => r.customerId === customer?.id);
  const unpaidInvoices = customerInvoices?.filter(inv => inv.status === "unpaid");

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">No customer data available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2196F3]/10 via-background to-[#1DBF73]/10">
      <div className="container max-w-6xl mx-auto p-8 space-y-8">
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-[#2196F3] to-[#1DBF73] flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6-10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </div>
          <h1 className="text-5xl font-serif font-semibold bg-gradient-to-r from-[#2196F3] to-[#1DBF73] bg-clip-text text-transparent">
            SillyDog Portal
          </h1>
          <p className="text-muted-foreground mt-2">Welcome back, {customer.name}!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Next Service</p>
                  <p className="text-2xl font-bold mt-1">
                    {customerRoutes && customerRoutes.length > 0 ? "Scheduled" : "None"}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#1DBF73] flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className="text-2xl font-bold mt-1">
                    ${unpaidInvoices?.reduce((sum, inv) => sum + parseFloat(inv.amount), 0).toFixed(2) || "0.00"}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#1DBF73] to-[#2196F3] flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Service Plan</p>
                  <p className="text-2xl font-bold mt-1 capitalize">{customer.servicePlan.replace('-', ' ')}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#1DBF73] flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
              <CardDescription>Your service information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <span className="text-muted-foreground">Service Address</span>
                <span className="font-medium text-right">{customer.address}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b">
                <span className="text-muted-foreground">Number of Dogs</span>
                <span className="font-medium">{customer.numberOfDogs}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b">
                <span className="text-muted-foreground">Plan Type</span>
                <span className="font-medium capitalize">{customer.servicePlan.replace('-', ' ')}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-muted-foreground">Status</span>
                <div className={`text-xs font-medium px-3 py-1 rounded-full ${
                  customer.status === "active" 
                    ? "bg-green-100 text-green-800" 
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {customer.status}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Your billing history</CardDescription>
            </CardHeader>
            <CardContent>
              {customerInvoices && customerInvoices.length > 0 ? (
                <div className="space-y-3">
                  {customerInvoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">#{invoice.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">Due: {invoice.dueDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${parseFloat(invoice.amount).toFixed(2)}</p>
                        <div className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${
                          invoice.status === "paid" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {invoice.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No invoices yet</p>
              )}
              {unpaidInvoices && unpaidInvoices.length > 0 && (
                <Button className="w-full mt-4 bg-gradient-to-r from-[#2196F3] to-[#1DBF73]" data-testid="button-pay">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay Outstanding Balance
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
