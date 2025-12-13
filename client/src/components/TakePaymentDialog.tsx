import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CreditCard, FileText, DollarSign, Loader2, Banknote } from "lucide-react";
import type { Customer, Invoice } from "@shared/schema";
import { format } from "date-fns";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface TakePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  preselectedInvoiceIds?: string[];
}

const cardPaymentSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0.50,
    "Amount must be at least $0.50"
  ),
  notes: z.string().optional(),
  invoiceIds: z.array(z.string()).optional(),
});

const checkPaymentSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0.01,
    "Amount must be at least $0.01"
  ),
  checkNumber: z.string().min(1, "Check number is required"),
  checkDate: z.string().optional(),
  notes: z.string().optional(),
  invoiceIds: z.array(z.string()).optional(),
});

const cashPaymentSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0.01,
    "Amount must be at least $0.01"
  ),
  notes: z.string().optional(),
  invoiceIds: z.array(z.string()).optional(),
});

type CardPaymentValues = z.infer<typeof cardPaymentSchema>;
type CheckPaymentValues = z.infer<typeof checkPaymentSchema>;
type CashPaymentValues = z.infer<typeof cashPaymentSchema>;

function CardPaymentForm({ 
  clientSecret, 
  paymentId, 
  paymentIntentId,
  invoiceIds,
  onSuccess,
  onCancel,
}: { 
  clientSecret: string;
  paymentId: string;
  paymentIntentId: string;
  invoiceIds: string[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/field-payments/confirm-card", {
        paymentId,
        paymentIntentId,
        invoiceIds,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Payment Successful", description: "Card payment has been processed." });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });

      if (error) {
        toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        await confirmMutation.mutateAsync();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || processing}>
          {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Process Payment
        </Button>
      </div>
    </form>
  );
}

export function TakePaymentDialog({ open, onOpenChange, customer, preselectedInvoiceIds = [] }: TakePaymentDialogProps) {
  const [activeTab, setActiveTab] = useState("card");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>(preselectedInvoiceIds);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: unpaidInvoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/customers", customer.id, "unpaid-invoices"],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customer.id}/unpaid-invoices`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
    enabled: open,
  });

  const cardForm = useForm<CardPaymentValues>({
    resolver: zodResolver(cardPaymentSchema),
    defaultValues: { amount: "", notes: "", invoiceIds: [] },
  });

  const checkForm = useForm<CheckPaymentValues>({
    resolver: zodResolver(checkPaymentSchema),
    defaultValues: { amount: "", checkNumber: "", checkDate: format(new Date(), "yyyy-MM-dd"), notes: "", invoiceIds: [] },
  });

  const cashForm = useForm<CashPaymentValues>({
    resolver: zodResolver(cashPaymentSchema),
    defaultValues: { amount: "", notes: "", invoiceIds: [] },
  });

  useEffect(() => {
    if (open) {
      // Reset selected invoices when dialog opens
      setSelectedInvoiceIds(preselectedInvoiceIds.length > 0 ? preselectedInvoiceIds : []);
      // Reset payment state
      setClientSecret(null);
      setPaymentId(null);
      setPaymentIntentId(null);
      // Reset forms
      cardForm.reset({ amount: "", notes: "", invoiceIds: [] });
      checkForm.reset({ amount: "", checkNumber: "", checkDate: format(new Date(), "yyyy-MM-dd"), notes: "", invoiceIds: [] });
      cashForm.reset({ amount: "", notes: "", invoiceIds: [] });
      // Reset tab
      setActiveTab("card");
    }
  }, [open, preselectedInvoiceIds]);

  const totalSelected = selectedInvoiceIds.reduce((sum, id) => {
    const invoice = unpaidInvoices.find(inv => inv.id === id);
    return sum + (invoice ? parseFloat(invoice.amount) : 0);
  }, 0);

  useEffect(() => {
    if (totalSelected > 0) {
      cardForm.setValue("amount", totalSelected.toFixed(2));
      checkForm.setValue("amount", totalSelected.toFixed(2));
      cashForm.setValue("amount", totalSelected.toFixed(2));
    }
  }, [totalSelected]);

  const createCardIntentMutation = useMutation({
    mutationFn: async (data: CardPaymentValues) => {
      const response = await apiRequest("POST", "/api/field-payments/card-intent", {
        customerId: customer.id,
        amount: parseFloat(data.amount),
        invoiceIds: selectedInvoiceIds,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setPaymentId(data.paymentId);
      setPaymentIntentId(data.paymentIntentId);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const recordCheckMutation = useMutation({
    mutationFn: async (data: CheckPaymentValues) => {
      const response = await apiRequest("POST", "/api/field-payments/check", {
        customerId: customer.id,
        amount: parseFloat(data.amount),
        checkNumber: data.checkNumber,
        checkDate: data.checkDate,
        invoiceIds: selectedInvoiceIds,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Check Payment Recorded", description: "The check payment has been recorded." });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const recordCashMutation = useMutation({
    mutationFn: async (data: CashPaymentValues) => {
      const response = await apiRequest("POST", "/api/field-payments/cash", {
        customerId: customer.id,
        amount: parseFloat(data.amount),
        invoiceIds: selectedInvoiceIds,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Cash Payment Recorded", description: "The cash payment has been recorded." });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setClientSecret(null);
    setPaymentId(null);
    setPaymentIntentId(null);
    setSelectedInvoiceIds([]);
    cardForm.reset();
    checkForm.reset();
    cashForm.reset();
    onOpenChange(false);
  };

  const toggleInvoice = (invoiceId: string) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(invoiceId) ? prev.filter(id => id !== invoiceId) : [...prev, invoiceId]
    );
  };

  const onCardSubmit = (data: CardPaymentValues) => {
    createCardIntentMutation.mutate(data);
  };

  const onCheckSubmit = (data: CheckPaymentValues) => {
    recordCheckMutation.mutate(data);
  };

  const onCashSubmit = (data: CashPaymentValues) => {
    recordCashMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Take Payment - {customer.name}
          </DialogTitle>
          <DialogDescription>
            Record a payment from the customer in the field
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {unpaidInvoices.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Apply to Invoices (Optional)
                </CardTitle>
                <CardDescription>Select invoices to apply this payment to</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {unpaidInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                        onClick={() => toggleInvoice(invoice.id)}
                        data-testid={`invoice-checkbox-${invoice.id}`}
                      >
                        <Checkbox
                          checked={selectedInvoiceIds.includes(invoice.id)}
                          onCheckedChange={() => toggleInvoice(invoice.id)}
                        />
                        <div className="flex-1">
                          <span className="font-medium">{invoice.invoiceNumber}</span>
                          <span className="text-muted-foreground ml-2">
                            Due: {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                          </span>
                        </div>
                        <span className="font-semibold">${parseFloat(invoice.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selectedInvoiceIds.length > 0 && (
                  <div className="mt-2 pt-2 border-t flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {selectedInvoiceIds.length} invoice(s) selected
                    </span>
                    <span className="font-semibold">Total: ${totalSelected.toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="card" className="flex items-center gap-2" data-testid="tab-card">
                <CreditCard className="h-4 w-4" />
                Card
              </TabsTrigger>
              <TabsTrigger value="check" className="flex items-center gap-2" data-testid="tab-check">
                <FileText className="h-4 w-4" />
                Check
              </TabsTrigger>
              <TabsTrigger value="cash" className="flex items-center gap-2" data-testid="tab-cash">
                <Banknote className="h-4 w-4" />
                Cash
              </TabsTrigger>
            </TabsList>

            <TabsContent value="card" className="mt-4">
              {clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CardPaymentForm
                    clientSecret={clientSecret}
                    paymentId={paymentId!}
                    paymentIntentId={paymentIntentId!}
                    invoiceIds={selectedInvoiceIds}
                    onSuccess={handleClose}
                    onCancel={() => {
                      setClientSecret(null);
                      setPaymentId(null);
                      setPaymentIntentId(null);
                    }}
                  />
                </Elements>
              ) : (
                <Form {...cardForm}>
                  <form onSubmit={cardForm.handleSubmit(onCardSubmit)} className="space-y-4">
                    <FormField
                      control={cardForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.50"
                              placeholder="0.00"
                              data-testid="input-card-amount"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cardForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Payment notes..."
                              data-testid="input-card-notes"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={handleClose}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createCardIntentMutation.isPending}>
                        {createCardIntentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Continue to Payment
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </TabsContent>

            <TabsContent value="check" className="mt-4">
              <Form {...checkForm}>
                <form onSubmit={checkForm.handleSubmit(onCheckSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={checkForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0.00"
                              data-testid="input-check-amount"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={checkForm.control}
                      name="checkNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Check Number</FormLabel>
                          <FormControl>
                            <Input placeholder="1234" data-testid="input-check-number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={checkForm.control}
                    name="checkDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Check Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-check-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={checkForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Payment notes..." data-testid="input-check-notes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={recordCheckMutation.isPending}>
                      {recordCheckMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Record Check Payment
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="cash" className="mt-4">
              <Form {...cashForm}>
                <form onSubmit={cashForm.handleSubmit(onCashSubmit)} className="space-y-4">
                  <FormField
                    control={cashForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            data-testid="input-cash-amount"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={cashForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Payment notes..." data-testid="input-cash-notes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={recordCashMutation.isPending}>
                      {recordCashMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Record Cash Payment
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
