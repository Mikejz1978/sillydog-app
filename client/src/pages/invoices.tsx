import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, DollarSign, Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
            return (
              <Card key={invoice.id} className="hover-elevate" data-testid={`invoice-card-${invoice.id}`}>
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
                      <Button variant="outline" size="sm" className="mt-2" data-testid={`button-download-${invoice.id}`}>
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
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
    </div>
  );
}
