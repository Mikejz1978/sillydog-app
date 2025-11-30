import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Calendar, 
  DollarSign, 
  CreditCard, 
  MapPin, 
  Settings, 
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  Home,
  Dog,
  Key,
  MessageSquare,
  Bell,
  Loader2,
  Camera,
  History
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Invoice, Route, JobHistory, ServiceType } from "@shared/schema";
import logoImage from "@assets/logo_1762200437346.png";
import { format, parseISO, isFuture, isToday } from "date-fns";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

// Payment Form Component for Stripe Elements
function PaymentForm({ 
  onSuccess, 
  onCancel,
  amount 
}: { 
  onSuccess: () => void; 
  onCancel: () => void;
  amount: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "Payment failed");
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      toast({
        title: "Payment Successful",
        description: `Your payment of $${amount.toFixed(2)} has been processed.`,
      });
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {errorMessage && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {errorMessage}
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
          data-testid="button-confirm-payment"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Pay ${amount.toFixed(2)}
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// This is a simplified customer portal for demonstration
// In production, this would require customer authentication
export default function CustomerPortal() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: "",
    email: "",
    gateCode: "",
    yardNotes: "",
    smsOptIn: true,
    autopayEnabled: false,
  });

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

  // For demo purposes, we'll show data for the first customer
  const { data: customers, isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: routes } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
  });

  const { data: jobHistory } = useQuery<JobHistory[]>({
    queryKey: ["/api/job-history"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const customer = customers?.[0];
  const customerInvoices = useMemo(() => 
    invoices?.filter(inv => inv.customerId === customer?.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [],
    [invoices, customer?.id]
  );
  
  const upcomingRoutes = useMemo(() => 
    routes?.filter(r => 
      r.customerId === customer?.id && 
      (r.status === "scheduled" || r.status === "in_route") &&
      (isFuture(parseISO(r.date)) || isToday(parseISO(r.date)))
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [],
    [routes, customer?.id]
  );

  const customerJobHistory = useMemo(() =>
    jobHistory?.filter(j => j.customerId === customer?.id)
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()) || [],
    [jobHistory, customer?.id]
  );

  const unpaidInvoices = customerInvoices?.filter(inv => inv.status === "unpaid" || inv.status === "overdue");
  const outstandingBalance = unpaidInvoices?.reduce((sum, inv) => sum + parseFloat(inv.amount), 0) || 0;

  const customerServiceType = serviceTypes?.find(st => st.id === customer?.serviceTypeId);

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (data: Partial<Customer>) => {
      return await apiRequest("PATCH", `/api/customers/${customer?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsEditing(false);
      toast({
        title: "Settings Updated",
        description: "Your account settings have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditClick = () => {
    if (customer) {
      setEditForm({
        phone: customer.phone || "",
        email: customer.email || "",
        gateCode: customer.gateCode || "",
        yardNotes: customer.yardNotes || "",
        smsOptIn: customer.smsOptIn ?? true,
        autopayEnabled: customer.autopayEnabled ?? false,
      });
      setIsEditing(true);
    }
  };

  const handleSaveSettings = () => {
    updateCustomerMutation.mutate({
      phone: editForm.phone,
      email: editForm.email || null,
      gateCode: editForm.gateCode || null,
      yardNotes: editForm.yardNotes || null,
      smsOptIn: editForm.smsOptIn,
      autopayEnabled: editForm.autopayEnabled,
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // Payment handlers
  const handlePayNow = async () => {
    if (outstandingBalance <= 0 || !unpaidInvoices?.length) return;
    
    setIsCreatingPayment(true);
    try {
      const response = await apiRequest("POST", "/api/create-payment-intent", {
        amount: outstandingBalance,
        invoiceId: unpaidInvoices[0].id, // For single invoice, or handle multiple
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
      setPaymentDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const handlePaymentSuccess = async () => {
    // Mark invoices as paid
    if (unpaidInvoices) {
      for (const invoice of unpaidInvoices) {
        try {
          await apiRequest("POST", `/api/invoices/${invoice.id}/pay`, {
            paymentIntentId: "stripe_payment",
          });
        } catch (error) {
          console.error("Failed to mark invoice as paid:", error);
        }
      }
    }
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    
    setPaymentDialogOpen(false);
    setClientSecret(null);
  };

  const handlePaymentCancel = () => {
    setPaymentDialogOpen(false);
    setClientSecret(null);
  };

  if (customersLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Dog className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No customer data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00BCD4]/10 via-background to-[#FF6F00]/10">
      <div className="container max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="text-center py-8">
          <img 
            src={logoImage} 
            alt="SillyDog Logo" 
            className="w-20 h-20 mx-auto mb-3 object-contain"
            data-testid="img-portal-logo"
          />
          <h1 className="text-4xl md:text-5xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent">
            Customer Portal
          </h1>
          <p className="text-muted-foreground mt-2">Welcome back, {customer.name}!</p>
        </div>

        {/* Main Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto gap-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 py-3" data-testid="tab-dashboard">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2 py-3" data-testid="tab-services">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Services</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2 py-3" data-testid="tab-billing">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 py-3" data-testid="tab-history">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 py-3" data-testid="tab-settings">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover-elevate">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Next Service</p>
                      <p className="text-xl font-bold mt-1">
                        {upcomingRoutes.length > 0 
                          ? format(parseISO(upcomingRoutes[0].date), "MMM d, yyyy")
                          : "None scheduled"
                        }
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center">
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
                      <p className={`text-xl font-bold mt-1 ${outstandingBalance > 0 ? "text-orange-600" : "text-green-600"}`}>
                        ${outstandingBalance.toFixed(2)}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#FF6F00] to-[#00BCD4] flex items-center justify-center">
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
                      <p className="text-xl font-bold mt-1">
                        {customerServiceType?.name || "Standard"}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center">
                      <Dog className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Service Details & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Service Details
                  </CardTitle>
                  <CardDescription>Your current service information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between py-3 border-b">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      Address
                    </span>
                    <span className="font-medium text-right max-w-[60%]">{customer.address}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Dog className="w-4 h-4" />
                      Number of Dogs
                    </span>
                    <span className="font-medium">{customer.numberOfDogs}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Service Plan
                    </span>
                    <span className="font-medium">{customerServiceType?.name || "Standard"}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Price per Visit
                    </span>
                    <span className="font-medium">${customerServiceType?.basePrice || "0.00"}</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                      {customer.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Upcoming Services
                  </CardTitle>
                  <CardDescription>Your next scheduled visits</CardDescription>
                </CardHeader>
                <CardContent>
                  {upcomingRoutes.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingRoutes.slice(0, 5).map((route) => (
                        <div key={route.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00BCD4]/20 to-[#FF6F00]/20 flex items-center justify-center">
                              <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{format(parseISO(route.date), "EEEE, MMM d")}</p>
                              <p className="text-xs text-muted-foreground">
                                {isToday(parseISO(route.date)) ? "Today" : format(parseISO(route.date), "yyyy")}
                              </p>
                            </div>
                          </div>
                          <Badge variant={route.status === "in_route" ? "default" : "secondary"}>
                            {route.status === "in_route" ? "In Progress" : "Scheduled"}
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
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Upcoming Services
                </CardTitle>
                <CardDescription>All your scheduled service visits</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingRoutes.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {upcomingRoutes.map((route) => (
                        <div key={route.id} className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#00BCD4]/20 to-[#FF6F00]/20 flex items-center justify-center">
                              <Calendar className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{format(parseISO(route.date), "EEEE, MMMM d, yyyy")}</p>
                              <p className="text-sm text-muted-foreground">
                                {route.scheduledTime ? `Scheduled for ${route.scheduledTime}` : "Time TBD"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant={route.status === "in_route" ? "default" : "secondary"}
                              className="mb-1"
                            >
                              {route.status === "in_route" ? "In Progress" : "Scheduled"}
                            </Badge>
                            {isToday(parseISO(route.date)) && (
                              <p className="text-xs text-green-600 font-medium">Today</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No upcoming services scheduled</p>
                    <p className="text-sm mt-2">Contact us to schedule your next service</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="mt-6 space-y-6">
            {/* Outstanding Balance Alert */}
            {outstandingBalance > 0 && (
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-orange-800 dark:text-orange-200">Outstanding Balance</p>
                        <p className="text-2xl font-bold text-orange-600">${outstandingBalance.toFixed(2)}</p>
                      </div>
                    </div>
                    <Button 
                      onClick={handlePayNow}
                      disabled={isCreatingPayment}
                      className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" 
                      data-testid="button-pay-balance"
                    >
                      {isCreatingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Pay Now
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invoice History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Invoice History
                </CardTitle>
                <CardDescription>Your billing and payment history</CardDescription>
              </CardHeader>
              <CardContent>
                {customerInvoices.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {customerInvoices.map((invoice) => (
                        <div key={invoice.id} className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              invoice.status === "paid" 
                                ? "bg-green-100 dark:bg-green-900/30" 
                                : "bg-yellow-100 dark:bg-yellow-900/30"
                            }`}>
                              {invoice.status === "paid" ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <Clock className="w-5 h-5 text-yellow-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">Invoice #{invoice.invoiceNumber}</p>
                              <p className="text-sm text-muted-foreground">
                                Due: {format(parseISO(invoice.dueDate), "MMM d, yyyy")}
                              </p>
                              {invoice.description && (
                                <p className="text-xs text-muted-foreground mt-1">{invoice.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-lg">${parseFloat(invoice.amount).toFixed(2)}</p>
                            <Badge variant={invoice.status === "paid" ? "default" : invoice.status === "overdue" ? "destructive" : "secondary"}>
                              {invoice.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No invoices yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Service History
                </CardTitle>
                <CardDescription>Past completed services</CardDescription>
              </CardHeader>
              <CardContent>
                {customerJobHistory.length > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {customerJobHistory.map((job) => (
                        <div key={job.id} className="p-4 rounded-lg border">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              </div>
                              <div>
                                <p className="font-medium">{format(parseISO(job.serviceDate), "EEEE, MMMM d, yyyy")}</p>
                                {job.duration && (
                                  <p className="text-sm text-muted-foreground">
                                    Duration: {job.duration} minutes
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge variant="default">Completed</Badge>
                          </div>
                          
                          {job.notes && (
                            <p className="text-sm text-muted-foreground mb-3 pl-13">
                              Notes: {job.notes}
                            </p>
                          )}

                          {/* Before/After Photos */}
                          {(job.photoBefore || job.photoAfter) && (
                            <div className="grid grid-cols-2 gap-4 mt-3">
                              {job.photoBefore && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                    <Camera className="w-3 h-3" /> Before
                                  </p>
                                  <img 
                                    src={job.photoBefore} 
                                    alt="Before service" 
                                    className="rounded-lg w-full h-32 object-cover"
                                  />
                                </div>
                              )}
                              {job.photoAfter && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                    <Camera className="w-3 h-3" /> After
                                  </p>
                                  <img 
                                    src={job.photoAfter} 
                                    alt="After service" 
                                    className="rounded-lg w-full h-32 object-cover"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No service history yet</p>
                    <p className="text-sm mt-2">Completed services will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Account Settings
                  </CardTitle>
                  <CardDescription>Manage your contact information and preferences</CardDescription>
                </div>
                {!isEditing && (
                  <Button onClick={handleEditClick} variant="outline" data-testid="button-edit-settings">
                    Edit Settings
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-6">
                    {/* Contact Information */}
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Contact Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            placeholder="(555) 555-5555"
                            data-testid="input-phone"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            placeholder="email@example.com"
                            data-testid="input-email"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Property Access */}
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Property Access
                      </h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="gateCode">Gate Code</Label>
                          <Input
                            id="gateCode"
                            value={editForm.gateCode}
                            onChange={(e) => setEditForm({ ...editForm, gateCode: e.target.value })}
                            placeholder="Enter gate code"
                            data-testid="input-gate-code"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="yardNotes">Yard Notes & Special Instructions</Label>
                          <Textarea
                            id="yardNotes"
                            value={editForm.yardNotes}
                            onChange={(e) => setEditForm({ ...editForm, yardNotes: e.target.value })}
                            placeholder="Enter any special instructions for our technicians..."
                            rows={3}
                            data-testid="input-yard-notes"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Preferences */}
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Preferences
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">SMS Notifications</p>
                              <p className="text-sm text-muted-foreground">
                                Receive text messages about your service
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={editForm.smsOptIn}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, smsOptIn: checked })}
                            data-testid="switch-sms-opt-in"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">Autopay</p>
                              <p className="text-sm text-muted-foreground">
                                Automatically pay invoices when due
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={editForm.autopayEnabled}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, autopayEnabled: checked })}
                            data-testid="switch-autopay"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={handleSaveSettings}
                        disabled={updateCustomerMutation.isPending}
                        className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
                        data-testid="button-save-settings"
                      >
                        {updateCustomerMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleCancelEdit} data-testid="button-cancel-edit">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Contact Information (View Mode) */}
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Contact Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Phone
                          </span>
                          <span className="font-medium">{customer.phone}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email
                          </span>
                          <span className="font-medium">{customer.email || "Not set"}</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Property Access (View Mode) */}
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Property Access
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground">Gate Code</span>
                          <span className="font-medium">{customer.gateCode || "Not set"}</span>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground block mb-2">Yard Notes</span>
                          <span className="font-medium">{customer.yardNotes || "No special instructions"}</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Preferences (View Mode) */}
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Preferences
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            SMS Notifications
                          </span>
                          <Badge variant={customer.smsOptIn ? "default" : "secondary"}>
                            {customer.smsOptIn ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Autopay
                          </span>
                          <Badge variant={customer.autopayEnabled ? "default" : "secondary"}>
                            {customer.autopayEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Read-only Service Info */}
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Service Information
                        <span className="text-xs font-normal text-muted-foreground">(Contact us to change)</span>
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between p-4 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground">Service Address</span>
                          <span className="font-medium text-right max-w-[60%]">{customer.address}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground">Number of Dogs</span>
                          <span className="font-medium">{customer.numberOfDogs}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground">Service Plan</span>
                          <span className="font-medium">{customerServiceType?.name || "Standard"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>Need help? Contact us at support@sillydogpoopscoop.com</p>
          <p className="mt-1">SillyDog Pooper Scooper Services</p>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pay Outstanding Balance
            </DialogTitle>
            <DialogDescription>
              Total amount: ${outstandingBalance.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          {clientSecret && (
            <Elements 
              stripe={stripePromise} 
              options={{ 
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#00BCD4',
                  },
                },
              }}
            >
              <PaymentForm 
                onSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
                amount={outstandingBalance}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
