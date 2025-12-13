import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
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
  History,
  LogOut,
  Trash2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Invoice, Route, JobHistory, ServiceType } from "@shared/schema";
import logoImage from "@assets/logo_1762200437346.png";
import { format, parseISO, isFuture, isToday } from "date-fns";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

// Mobile device detection - checks for mobile browsers and touch devices
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  // Check for common mobile user agents
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  // Also check for touch capability and small screen
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  return mobileRegex.test(userAgent.toLowerCase()) || (isTouchDevice && isSmallScreen);
}

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

// Setup Form Component for saving card on file
function SetupForm({ 
  onSuccess, 
  onCancel,
}: { 
  onSuccess: (paymentMethodId: string) => void; 
  onCancel: () => void;
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

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "Setup failed");
      setIsProcessing(false);
    } else if (setupIntent && setupIntent.status === "succeeded") {
      // Get the payment method ID from the setup intent
      const paymentMethodId = setupIntent.payment_method as string;
      toast({
        title: "Card Saved",
        description: "Your card has been saved for autopay.",
      });
      onSuccess(paymentMethodId);
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
          data-testid="button-save-card"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Save Card
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

interface PortalData {
  customer: Customer;
  invoices: Invoice[];
  routes: Route[];
  jobHistory: JobHistory[];
  serviceType: ServiceType | null;
}

export default function CustomerPortal() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
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
  
  // Card management state
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [isSettingUpCard, setIsSettingUpCard] = useState(false);
  const [isRemovingCard, setIsRemovingCard] = useState(false);

  // Check authentication
  const { data: authData, isLoading: authLoading, isError: authError } = useQuery<{ customer: Customer }>({
    queryKey: ["/api/portal/me"],
    retry: false,
  });

  // Get portal data
  const { data: portalData, isLoading: dataLoading, refetch: refetchData } = useQuery<PortalData>({
    queryKey: ["/api/portal/data"],
    enabled: !!authData?.customer,
    retry: false,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && (authError || !authData?.customer)) {
      setLocation("/portal/login");
    }
  }, [authLoading, authError, authData, setLocation]);

  // Handle query params for Stripe redirect returns (success/cancel)
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const sessionId = params.get("session_id");
    const canceled = params.get("canceled");
    
    if (sessionId) {
      // Payment success - returned from Stripe Checkout
      // Reconcile the payment server-side to mark all invoices as paid
      (async () => {
        try {
          await apiRequest("POST", "/api/portal/reconcile-payment", {
            sessionId: sessionId,
          });
          toast({
            title: "Payment Successful!",
            description: "Your payment has been processed and invoices have been updated.",
          });
        } catch (error: any) {
          console.error("Failed to reconcile payment:", error);
          // Payment was received but invoice update failed
          toast({
            title: "Payment Received",
            description: "Your payment was processed but there was an issue updating your invoices. Please contact support if your balance doesn't update.",
            variant: "destructive",
          });
        }
        refetchData();
        window.history.replaceState({}, "", "/portal");
        setActiveTab("billing");
      })();
    } else if (canceled === "1") {
      // Payment was canceled
      toast({
        title: "Payment Canceled",
        description: "Your payment was not processed.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/portal");
    }
  }, [searchString, toast]);

  const customer = portalData?.customer;
  const customerInvoices = useMemo(() => 
    portalData?.invoices
      ?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [],
    [portalData?.invoices]
  );
  
  const upcomingRoutes = useMemo(() => 
    portalData?.routes?.filter(r => 
      (r.status === "scheduled" || r.status === "in_route") &&
      (isFuture(parseISO(r.date)) || isToday(parseISO(r.date)))
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [],
    [portalData?.routes]
  );

  const customerJobHistory = useMemo(() =>
    portalData?.jobHistory
      ?.sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()) || [],
    [portalData?.jobHistory]
  );

  const unpaidInvoices = customerInvoices?.filter(inv => inv.status === "unpaid" || inv.status === "overdue");
  const outstandingBalance = unpaidInvoices?.reduce((sum, inv) => sum + parseFloat(inv.amount), 0) || 0;

  const customerServiceType = portalData?.serviceType;

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/portal/logout", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/data"] });
      setLocation("/portal/login");
    },
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (data: Partial<Customer>) => {
      return await apiRequest("PATCH", "/api/portal/profile", data);
    },
    onSuccess: () => {
      refetchData();
      queryClient.invalidateQueries({ queryKey: ["/api/portal/me"] });
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

  // Payment handlers - hybrid flow (mobile redirect, desktop embed)
  const handlePayNow = async () => {
    if (outstandingBalance <= 0 || !unpaidInvoices?.length || !customer) return;
    
    setIsCreatingPayment(true);
    try {
      if (isMobileDevice()) {
        // Mobile: Use Stripe Checkout redirect (avoids keyboard/scroll issues)
        const response = await apiRequest("POST", "/api/create-checkout-session", {
          amount: outstandingBalance,
          customerId: customer.id,
          invoiceIds: unpaidInvoices.map(inv => inv.id),
          description: `Payment for ${unpaidInvoices.length} invoice(s)`,
        });
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL returned");
        }
      } else {
        // Desktop: Use embedded Stripe Elements
        const response = await apiRequest("POST", "/api/create-payment-intent", {
          amount: outstandingBalance,
          invoiceIds: unpaidInvoices.map(inv => inv.id),
        });
        const data = await response.json();
        setClientSecret(data.clientSecret);
        setPaymentDialogOpen(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
      setIsCreatingPayment(false);
    } finally {
      if (!isMobileDevice()) {
        setIsCreatingPayment(false);
      }
    }
  };
  
  // Handle adding a card for autopay
  const handleSetupCard = async () => {
    if (!customer) return;
    
    setIsSettingUpCard(true);
    try {
      const response = await apiRequest("POST", "/api/create-setup-intent", {
        customerId: customer.id,
      });
      const data = await response.json();
      setSetupClientSecret(data.clientSecret);
      setSetupDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to set up card. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSettingUpCard(false);
    }
  };
  
  // Handle removing saved card
  const handleRemoveCard = async () => {
    if (!customer) return;
    
    setIsRemovingCard(true);
    try {
      await apiRequest("POST", "/api/portal/remove-card", {});
      toast({
        title: "Card Removed",
        description: "Your saved card has been removed.",
      });
      refetchData();
      queryClient.invalidateQueries({ queryKey: ["/api/portal/me"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to remove card. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRemovingCard(false);
    }
  };

  const handlePaymentSuccess = async () => {
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
    
    refetchData();
    setPaymentDialogOpen(false);
    setClientSecret(null);
  };

  const handlePaymentCancel = () => {
    setPaymentDialogOpen(false);
    setClientSecret(null);
  };

  const handleSetupSuccess = async (paymentMethodId: string) => {
    // Save the payment method ID to the customer record in the database
    try {
      await apiRequest("POST", "/api/portal/save-payment-method", {
        paymentMethodId,
      });
    } catch (error) {
      console.error("Failed to save payment method:", error);
    }
    refetchData();
    queryClient.invalidateQueries({ queryKey: ["/api/portal/me"] });
    setSetupDialogOpen(false);
    setSetupClientSecret(null);
  };

  const handleSetupCancel = () => {
    setSetupDialogOpen(false);
    setSetupClientSecret(null);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (authLoading || dataLoading) {
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
          <p className="text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00BCD4]/10 via-background to-[#FF6F00]/10">
      <div className="container max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="text-center py-8 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="absolute right-0 top-8"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
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
                          Processing...
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

            {/* Saved Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Method
                </CardTitle>
                <CardDescription>Manage your saved payment method for autopay</CardDescription>
              </CardHeader>
              <CardContent>
                {customer.stripePaymentMethodId ? (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#00BCD4]/20 to-[#FF6F00]/20 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">Card on File</p>
                        <p className="text-sm text-muted-foreground">
                          Your card is saved for autopay
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveCard}
                        disabled={isRemovingCard}
                        data-testid="button-remove-card"
                      >
                        {isRemovingCard ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg border border-dashed">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">No Card Saved</p>
                        <p className="text-sm text-muted-foreground">
                          Save a card for convenient autopay billing
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleSetupCard}
                      disabled={isSettingUpCard}
                      className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
                      data-testid="button-add-card"
                    >
                      {isSettingUpCard ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Setting up...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Add Card
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoices List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Invoice History
                </CardTitle>
                <CardDescription>Your billing history and invoices</CardDescription>
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
                                ? "bg-green-100 dark:bg-green-900" 
                                : "bg-orange-100 dark:bg-orange-900"
                            }`}>
                              {invoice.status === "paid" ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <Clock className="w-5 h-5 text-orange-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold">Invoice #{invoice.id.slice(-6)}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(invoice.createdAt), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${parseFloat(invoice.amount).toFixed(2)}</p>
                            <Badge 
                              variant={invoice.status === "paid" ? "default" : "secondary"}
                              className={invoice.status === "paid" ? "bg-green-600" : ""}
                            >
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
                <CardDescription>Record of completed services</CardDescription>
              </CardHeader>
              <CardContent>
                {customerJobHistory.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {customerJobHistory.map((job) => (
                        <div key={job.id} className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                              <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold">{format(parseISO(job.serviceDate), "EEEE, MMMM d, yyyy")}</p>
                              <p className="text-sm text-muted-foreground">
                                Service Completed
                              </p>
                              {job.notes && (
                                <p className="text-xs text-muted-foreground mt-1">{job.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {job.duration && (
                              <p className="text-sm text-muted-foreground">{job.duration} min</p>
                            )}
                            {(job.photoBefore || job.photoAfter) && (
                              <Badge variant="outline" className="mt-1">
                                <Camera className="w-3 h-3 mr-1" />
                                Photos
                              </Badge>
                            )}
                          </div>
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
                  <CardDescription>Update your contact information and preferences</CardDescription>
                </div>
                {!isEditing && (
                  <Button onClick={handleEditClick} variant="outline" data-testid="button-edit-settings">
                    Edit Settings
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          className="pl-10"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          data-testid="input-phone"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          className="pl-10"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          data-testid="input-email"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gateCode">Gate Code</Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="gateCode"
                          className="pl-10"
                          value={editForm.gateCode}
                          onChange={(e) => setEditForm({ ...editForm, gateCode: e.target.value })}
                          data-testid="input-gate-code"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="yardNotes">Yard Notes</Label>
                      <Textarea
                        id="yardNotes"
                        placeholder="Any special instructions for our technicians..."
                        value={editForm.yardNotes}
                        onChange={(e) => setEditForm({ ...editForm, yardNotes: e.target.value })}
                        data-testid="input-yard-notes"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">SMS Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive text updates about your service</p>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.smsOptIn}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, smsOptIn: checked })}
                        data-testid="switch-sms"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Autopay</p>
                          <p className="text-sm text-muted-foreground">Automatically pay invoices with your saved card</p>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.autopayEnabled}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, autopayEnabled: checked })}
                        data-testid="switch-autopay"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={handleSaveSettings}
                        className="flex-1 bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
                        disabled={updateCustomerMutation.isPending}
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
                      <Button variant="outline" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Phone
                      </span>
                      <span className="font-medium">{customer.phone}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </span>
                      <span className="font-medium">{customer.email || "Not set"}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Gate Code
                      </span>
                      <span className="font-medium">{customer.gateCode || "Not set"}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Yard Notes
                      </span>
                      <span className="font-medium text-right max-w-[60%]">{customer.yardNotes || "None"}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        SMS Notifications
                      </span>
                      <Badge variant={customer.smsOptIn ? "default" : "secondary"}>
                        {customer.smsOptIn ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Autopay
                      </span>
                      <Badge variant={customer.autopayEnabled ? "default" : "secondary"}>
                        {customer.autopayEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto [-webkit-overflow-scrolling:touch] pb-[calc(env(safe-area-inset-bottom)+120px)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pay Outstanding Balance
            </DialogTitle>
            <DialogDescription>
              Complete payment for your outstanding balance of ${outstandingBalance.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          {clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm
                amount={outstandingBalance}
                onSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>

      {/* Setup Card Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto [-webkit-overflow-scrolling:touch] pb-[calc(env(safe-area-inset-bottom)+120px)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Save Payment Method
            </DialogTitle>
            <DialogDescription>
              Save a card for convenient autopay billing. Your card will be securely stored.
            </DialogDescription>
          </DialogHeader>
          {setupClientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
              <SetupForm
                onSuccess={handleSetupSuccess}
                onCancel={handleSetupCancel}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
