import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  CreditCard, 
  Calendar, 
  DollarSign, 
  FileText, 
  Phone, 
  Mail, 
  MapPin, 
  Dog, 
  Key,
  ExternalLink,
  Bell,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import type { Customer, Invoice, Route, ServiceType, ScheduleRule } from "@shared/schema";
import { format, parseISO, isFuture, isToday } from "date-fns";

export default function PortalPreview() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: serviceTypes = [] } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    enabled: !!selectedCustomerId,
  });

  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
    enabled: !!selectedCustomerId,
  });

  const { data: schedules = [] } = useQuery<ScheduleRule[]>({
    queryKey: ["/api/schedule-rules"],
    enabled: !!selectedCustomerId,
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const customerInvoices = invoices.filter(inv => inv.customerId === selectedCustomerId);
  const customerRoutes = routes.filter(r => r.customerId === selectedCustomerId);
  const customerSchedules = schedules.filter(s => s.customerId === selectedCustomerId);

  const upcomingRoutes = customerRoutes
    .filter(r => {
      const routeDate = new Date(r.date);
      return isFuture(routeDate) || isToday(routeDate);
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  const unpaidInvoices = customerInvoices.filter(inv => inv.status !== "paid");
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

  const serviceType = serviceTypes.find(st => st.id === selectedCustomer?.serviceTypeId);

  const activeCustomers = customers.filter(c => c.status === "active");

  const getScheduleDaysDisplay = (schedule: ScheduleRule): string => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (schedule.byDay || []).map(d => dayNames[d]).join(", ");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Customer Portal Preview</h1>
          <p className="text-muted-foreground">View what your customers see in their portal</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Select Customer
          </CardTitle>
          <CardDescription>
            Choose a customer to preview their portal experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select 
            value={selectedCustomerId || ""} 
            onValueChange={(value) => setSelectedCustomerId(value)}
          >
            <SelectTrigger className="w-full md:w-96" data-testid="select-customer">
              <SelectValue placeholder="Select a customer..." />
            </SelectTrigger>
            <SelectContent>
              {activeCustomers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  <div className="flex items-center gap-2">
                    <span>{customer.name}</span>
                    {customer.portalPassword && (
                      <Badge variant="outline" className="text-xs">Portal Active</Badge>
                    )}
                    {customer.stripePaymentMethodId && (
                      <Badge variant="outline" className="text-xs">Card on File</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCustomer && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-gradient-to-r from-[#00BCD4]/10 via-background to-[#FF6F00]/10 border">
            <div className="text-center">
              <h2 className="text-2xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent">
                Customer Portal Preview
              </h2>
              <p className="text-muted-foreground">Viewing as: {selectedCustomer.name}</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="card-next-service">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-950/30">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next Service</p>
                    <p className="text-lg font-semibold">
                      {upcomingRoutes.length > 0 
                        ? format(parseISO(upcomingRoutes[0].date), "MMM d, yyyy")
                        : "Not scheduled"
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-outstanding-balance">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${totalOutstanding > 0 ? 'bg-red-100 dark:bg-red-950/30' : 'bg-green-100 dark:bg-green-950/30'}`}>
                    <DollarSign className={`w-5 h-5 ${totalOutstanding > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                    <p className={`text-lg font-semibold ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${totalOutstanding.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-service-plan">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-950/30">
                    <Dog className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Service Plan</p>
                    <p className="text-lg font-semibold">
                      {serviceType?.name || "Not set"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-payment-status">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${selectedCustomer.stripePaymentMethodId ? 'bg-green-100 dark:bg-green-950/30' : 'bg-yellow-100 dark:bg-yellow-950/30'}`}>
                    <CreditCard className={`w-5 h-5 ${selectedCustomer.stripePaymentMethodId ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="text-lg font-semibold">
                      {selectedCustomer.stripePaymentMethodId ? "Card on File" : "No card saved"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedCustomer.address || "No address"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedCustomer.phone || "No phone"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedCustomer.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Dog className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedCustomer.numberOfDogs} dog(s)</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Account Settings</h4>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      SMS Notifications
                    </span>
                    <Badge variant={selectedCustomer.smsOptIn ? "default" : "secondary"}>
                      {selectedCustomer.smsOptIn ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Autopay
                    </span>
                    <Badge variant={selectedCustomer.autopayEnabled ? "default" : "secondary"}>
                      {selectedCustomer.autopayEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Portal Access
                    </span>
                    <Badge variant={selectedCustomer.portalPassword ? "default" : "secondary"}>
                      {selectedCustomer.portalPassword ? "Active" : "Not Set"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Upcoming Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingRoutes.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingRoutes.map((route) => (
                      <div 
                        key={route.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                        data-testid={`route-item-${route.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {route.status === "completed" ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : route.status === "in_route" ? (
                            <Clock className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Calendar className="w-5 h-5 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium">{format(parseISO(route.date), "EEEE, MMMM d")}</p>
                            <p className="text-sm text-muted-foreground capitalize">{route.status}</p>
                          </div>
                        </div>
                        <Badge variant={route.status === "completed" ? "default" : "outline"}>
                          {isToday(parseISO(route.date)) ? "Today" : format(parseISO(route.date), "MMM d")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No upcoming services scheduled</p>
                  </div>
                )}

                {customerSchedules.length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="font-medium mb-3">Schedule Pattern</h4>
                    {customerSchedules.map((schedule) => (
                      <div key={schedule.id} className="flex items-center justify-between p-2 rounded bg-muted/20">
                        <span className="text-sm capitalize">{schedule.frequency}</span>
                        <Badge variant="outline">{getScheduleDaysDisplay(schedule)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Recent Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customerInvoices.length > 0 ? (
                <div className="space-y-3">
                  {customerInvoices.slice(0, 10).map((invoice) => (
                    <div 
                      key={invoice.id} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`invoice-item-${invoice.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {invoice.status === "paid" ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-600" />
                        )}
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-muted-foreground">Due: {invoice.dueDate}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${parseFloat(invoice.amount).toFixed(2)}</p>
                        <Badge variant={invoice.status === "paid" ? "default" : "destructive"}>
                          {invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No invoices found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedCustomer && !customersLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Select a customer above to preview their portal</p>
            <p className="text-sm mt-2">This shows you exactly what your customers see when they log in to their portal.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
