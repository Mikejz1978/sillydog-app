import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  const [paymentMethod, setPaymentMethod] = useState<"card" | "check" | "cash">("card");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [checkDate, setCheckDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>(preselectedInvoiceIds);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: unpaidInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/customers", customer.id, "unpaid-invoices"],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customer.id}/unpaid-invoices`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
    enabled: open,
  });

  // Reset dialog state every time it opens
  useEffect(() => {
    if (open) {
      setPaymentMethod("card");
      setAmount("");
      setNotes("");
      setCheckNumber("");
      setCheckDate(format(new Date(), "yyyy-MM-dd"));
      setSelectedInvoiceIds(preselectedInvoiceIds.length > 0 ? preselectedInvoiceIds : []);
      setClientSecret(null);
      setPaymentId(null);
      setPaymentIntentId(null);
    }
  }, [open]);

  const totalSelected = selectedInvoiceIds.reduce((sum, id) => {
    const invoice = unpaidInvoices.find(inv => inv.id === id);
    return sum + (invoice ? parseFloat(invoice.amount) : 0);
  }, 0);

  // Auto-fill amount when invoices are selected (only if amount is empty)
  useEffect(() => {
    if (totalSelected > 0 && amount === "") {
      setAmount(totalSelected.toFixed(2));
    }
  }, [totalSelected]);

  const createCardIntentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/field-payments/card-intent", {
        customerId: customer.id,
        amount: parseFloat(amount),
        invoiceIds: selectedInvoiceIds,
        notes,
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
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/field-payments/check", {
        customerId: customer.id,
        amount: parseFloat(amount),
        checkNumber,
        checkDate,
        invoiceIds: selectedInvoiceIds,
        notes,
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
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/field-payments/cash", {
        customerId: customer.id,
        amount: parseFloat(amount),
        invoiceIds: selectedInvoiceIds,
        notes,
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
    onOpenChange(false);
  };

  const toggleInvoice = (invoiceId: string) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(invoiceId) ? prev.filter(id => id !== invoiceId) : [...prev, invoiceId]
    );
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty, or valid decimal format with up to 2 decimal places
    if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
      setAmount(val);
    }
  };

  const handleSubmit = () => {
    const numericAmount = parseFloat(amount);
    
    if (!numericAmount || numericAmount <= 0) {
      toast({ title: "Error", description: "Enter a valid payment amount", variant: "destructive" });
      return;
    }

    if (paymentMethod === "card") {
      if (numericAmount < 0.50) {
        toast({ title: "Error", description: "Card payments must be at least $0.50", variant: "destructive" });
        return;
      }
      createCardIntentMutation.mutate();
    } else if (paymentMethod === "check") {
      if (!checkNumber.trim()) {
        toast({ title: "Error", description: "Check number is required", variant: "destructive" });
        return;
      }
      recordCheckMutation.mutate();
    } else if (paymentMethod === "cash") {
      recordCashMutation.mutate();
    }
  };

  const isProcessing = createCardIntentMutation.isPending || recordCheckMutation.isPending || recordCashMutation.isPending;

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

          {/* Payment Method Tabs - Always clickable */}
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={paymentMethod === "card" ? "default" : "outline"}
              onClick={() => setPaymentMethod("card")}
              className="flex-1 flex items-center justify-center gap-2"
              data-testid="tab-card"
            >
              <CreditCard className="h-4 w-4" />
              Card
            </Button>
            <Button
              type="button"
              variant={paymentMethod === "check" ? "default" : "outline"}
              onClick={() => setPaymentMethod("check")}
              className="flex-1 flex items-center justify-center gap-2"
              data-testid="tab-check"
            >
              <FileText className="h-4 w-4" />
              Check
            </Button>
            <Button
              type="button"
              variant={paymentMethod === "cash" ? "default" : "outline"}
              onClick={() => setPaymentMethod("cash")}
              className="flex-1 flex items-center justify-center gap-2"
              data-testid="tab-cash"
            >
              <Banknote className="h-4 w-4" />
              Cash
            </Button>
          </div>

          {/* Card Payment Form */}
          {paymentMethod === "card" && (
            <>
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
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="card-amount">Amount ($)</Label>
                    <Input
                      id="card-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={handleAmountChange}
                      data-testid="input-card-amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="card-notes">Notes (Optional)</Label>
                    <Textarea
                      id="card-notes"
                      placeholder="Payment notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      data-testid="input-card-notes"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={isProcessing}>
                      {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Continue to Payment
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Check Payment Form */}
          {paymentMethod === "check" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="check-amount">Amount ($)</Label>
                  <Input
                    id="check-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={handleAmountChange}
                    data-testid="input-check-amount"
                  />
                </div>
                <div>
                  <Label htmlFor="check-number">Check Number</Label>
                  <Input
                    id="check-number"
                    placeholder="1234"
                    value={checkNumber}
                    onChange={(e) => setCheckNumber(e.target.value)}
                    data-testid="input-check-number"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="check-date">Check Date</Label>
                <Input
                  id="check-date"
                  type="date"
                  value={checkDate}
                  onChange={(e) => setCheckDate(e.target.value)}
                  data-testid="input-check-date"
                />
              </div>
              <div>
                <Label htmlFor="check-notes">Notes (Optional)</Label>
                <Textarea
                  id="check-notes"
                  placeholder="Payment notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-check-notes"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSubmit} disabled={isProcessing}>
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Record Check Payment
                </Button>
              </div>
            </div>
          )}

          {/* Cash Payment Form */}
          {paymentMethod === "cash" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="cash-amount">Amount ($)</Label>
                <Input
                  id="cash-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={handleAmountChange}
                  data-testid="input-cash-amount"
                />
              </div>
              <div>
                <Label htmlFor="cash-notes">Notes (Optional)</Label>
                <Textarea
                  id="cash-notes"
                  placeholder="Payment notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-cash-notes"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSubmit} disabled={isProcessing}>
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Record Cash Payment
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
