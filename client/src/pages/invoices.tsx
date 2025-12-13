import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, DollarSign, Calendar, Download, Trash2, CreditCard } from "lucide-react";
import { TakePaymentDialog } from "@/components/TakePaymentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertInvoiceSchema, type Customer, type Invoice, type InsertInvoice, type ServiceType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [preselectedInvoiceIds, setPreselectedInvoiceIds] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertInvoice) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice Created",
        description: "New invoice has been generated.",
      });
      setDialogOpen(false);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      await apiRequest("DELETE", `/api/invoices/${invoiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice Deleted",
        description: "Invoice has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    },
  });

  const form = useForm<InsertInvoice>({
    resolver: zodResolver(insertInvoiceSchema),
    defaultValues: {
      customerId: "",
      invoiceNumber: `INV-${Date.now()}`,
      amount: "0.00",
      status: "unpaid",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: "",
    },
  });

  const selectedCustomerId = form.watch("customerId");
  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

  // Auto-calculate amount when customer changes
  const handleCustomerChange = (customerId: string) => {
    form.setValue("customerId", customerId);
    const customer = customers?.find(c => c.id === customerId);
    if (customer && customer.serviceTypeId) {
      const serviceType = serviceTypes?.find(st => st.id === customer.serviceTypeId);
      if (serviceType) {
        // Calculate per-visit cost: basePrice covers first dog, pricePerExtraDog for additional dogs
        const basePrice = typeof serviceType.basePrice === 'string' ? parseFloat(serviceType.basePrice) : serviceType.basePrice;
        const pricePerExtraDog = typeof serviceType.pricePerExtraDog === 'string' ? parseFloat(serviceType.pricePerExtraDog) : serviceType.pricePerExtraDog;
        const timesPerWeek = serviceType.timesPerWeek || 1;
        
        const extraDogs = Math.max(customer.numberOfDogs - 1, 0);
        const perVisitCost = basePrice + (pricePerExtraDog * extraDogs);
        // Calculate monthly amount: perVisitCost * timesPerWeek * 4 weeks
        const monthlyAmount = perVisitCost * timesPerWeek * 4;
        
        form.setValue("amount", monthlyAmount.toFixed(2));
        form.setValue("description", `${serviceType.name} (${timesPerWeek}x/week × 4 weeks) - ${customer.numberOfDogs} dog(s)`);
      }
    } else if (customer) {
      // Fallback for customers without service type
      form.setValue("amount", "25.00");
      form.setValue("description", `Service - ${customer.numberOfDogs} dog(s)`);
    }
  };

  const filteredInvoices = invoices?.filter((invoice) => {
    const customer = customers?.find(c => c.id === invoice.customerId);
    return (
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const stats = {
    total: invoices?.length || 0,
    paid: invoices?.filter(i => i.status === "paid").length || 0,
    unpaid: invoices?.filter(i => i.status === "unpaid").length || 0,
    overdue: invoices?.filter(i => i.status === "overdue").length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent" data-testid="title-invoices">
            Invoices
          </h1>
          <p className="text-muted-foreground mt-1">Manage billing and payments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" data-testid="button-create-invoice">
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>Generate an invoice for a customer</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={handleCustomerChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-customer">
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          data-testid="input-amount"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Service description" data-testid="input-description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-due-date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" data-testid="button-submit-invoice">
                    {createMutation.isPending ? "Creating..." : "Create Invoice"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold mt-1 text-green-600">{stats.paid}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unpaid</p>
                <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.unpaid}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{stats.overdue}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search invoices by number or customer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      <div className="space-y-3">
        {filteredInvoices && filteredInvoices.length > 0 ? (
          filteredInvoices.map((invoice) => {
            const customer = customers?.find(c => c.id === invoice.customerId);
            const serviceType = serviceTypes?.find(st => st.id === customer?.serviceTypeId);
            return (
              <Card 
                key={invoice.id} 
                className="hover-elevate cursor-pointer" 
                data-testid={`invoice-card-${invoice.id}`}
                onClick={() => {
                  setSelectedInvoice(invoice);
                  setDetailDialogOpen(true);
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center text-white">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">#{invoice.invoiceNumber}</h3>
                          <div className={`text-xs font-medium px-3 py-1 rounded-full ${
                            invoice.status === "paid" 
                              ? "bg-green-100 text-green-800" 
                              : invoice.status === "overdue"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {invoice.status}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{customer?.name}</p>
                        {invoice.description && (
                          <p className="text-xs text-muted-foreground mt-1">{invoice.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Due: {invoice.dueDate}
                          </div>
                          {invoice.paidAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Paid: {new Date(invoice.paidAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">${parseFloat(invoice.amount).toFixed(2)}</p>
                      <div className="flex gap-2 mt-2 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          data-testid={`button-download-${invoice.id}`}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                        {invoice.status !== "paid" && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                const invoiceCustomer = customers?.find(c => c.id === invoice.customerId);
                                if (invoiceCustomer) {
                                  setPaymentCustomer(invoiceCustomer);
                                  setPreselectedInvoiceIds([invoice.id]);
                                  setPaymentDialogOpen(true);
                                }
                              }}
                              className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] text-white border-0"
                              data-testid={`button-take-payment-${invoice.id}`}
                            >
                              <CreditCard className="w-3 h-3 mr-1" />
                              Take Payment
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setInvoiceToDelete(invoice);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${invoice.id}`}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No invoices found</p>
          </div>
        )}
      </div>

      {/* Invoice Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-invoice-detail">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              Complete information for invoice #{selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (() => {
            const customer = customers?.find(c => c.id === selectedInvoice.customerId);
            const serviceType = serviceTypes?.find(st => st.id === customer?.serviceTypeId);
            return (
              <div className="space-y-6">
                {/* Invoice Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">#{selectedInvoice.invoiceNumber}</h3>
                    <div className={`inline-block text-xs font-medium px-3 py-1 rounded-full mt-2 ${
                      selectedInvoice.status === "paid" 
                        ? "bg-green-100 text-green-800" 
                        : selectedInvoice.status === "overdue"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {selectedInvoice.status.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="text-3xl font-bold text-primary">
                      ${parseFloat(selectedInvoice.amount).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Customer Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{customer?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{customer?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{customer?.phone}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Address</p>
                      <p className="font-medium">{customer?.address}</p>
                    </div>
                  </div>
                </div>

                {/* Service Information */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Service Details</h4>
                  {selectedInvoice.description ? (
                    <p className="text-sm text-muted-foreground mb-3">{selectedInvoice.description}</p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Service Type</p>
                      <p className="font-medium">{serviceType?.name || 'N/A'}</p>
                    </div>
                    {serviceType && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Frequency</p>
                          <p className="font-medium">{serviceType.timesPerWeek}x per week</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Price Per Visit</p>
                          <p className="font-medium">${parseFloat(serviceType.basePrice.toString()).toFixed(2)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Invoice Dates */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Dates</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {selectedInvoice.createdAt 
                          ? new Date(selectedInvoice.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Due Date</p>
                      <p className="font-medium">{selectedInvoice.dueDate}</p>
                    </div>
                    {selectedInvoice.paidAt && (
                      <div>
                        <p className="text-muted-foreground">Paid Date</p>
                        <p className="font-medium">
                          {new Date(selectedInvoice.paidAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Information */}
                {selectedInvoice.stripePaymentIntentId && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Payment Information</h4>
                    <div className="text-sm">
                      <p className="text-muted-foreground">Stripe Payment ID</p>
                      <p className="font-mono text-xs">{selectedInvoice.stripePaymentIntentId}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t pt-4 flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    data-testid="button-download-invoice"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  {selectedInvoice.status !== "paid" && (
                    <Button 
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInvoiceToDelete(selectedInvoice);
                        setDetailDialogOpen(false);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid="button-delete-invoice"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Invoice
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-invoice">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice #{invoiceToDelete?.invoiceNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (invoiceToDelete) {
                  deleteMutation.mutate(invoiceToDelete.id);
                }
              }}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Take Payment Dialog */}
      {paymentCustomer && (
        <TakePaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          customer={paymentCustomer}
          preselectedInvoiceIds={preselectedInvoiceIds}
        />
      )}
    </div>
  );
}
