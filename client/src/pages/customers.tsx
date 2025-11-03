import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Phone, Mail, MapPin, DollarSign, Calendar, Trash2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  insertCustomerSchema, 
  insertScheduleRuleSchema,
  type Customer, 
  type InsertCustomer,
  type ScheduleRule,
  type InsertScheduleRule,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Schedule Management Dialog Component
function ScheduleDialog({ customer }: { customer: Customer }) {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: scheduleRules, isLoading: rulesLoading } = useQuery<ScheduleRule[]>({
    queryKey: ["/api/schedule-rules", customer.id],
    queryFn: async () => {
      const response = await fetch(`/api/schedule-rules?customerId=${customer.id}`);
      return response.json();
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await apiRequest("DELETE", `/api/schedule-rules/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-rules", customer.id] });
      toast({
        title: "Schedule Removed",
        description: "The schedule has been deleted.",
      });
    },
  });

  const scheduleForm = useForm<InsertScheduleRule>({
    resolver: zodResolver(insertScheduleRuleSchema),
    defaultValues: {
      customerId: customer.id,
      frequency: "weekly",
      byDay: 1, // Monday
      dtStart: new Date().toISOString().split("T")[0],
      windowStart: "08:00",
      windowEnd: "12:00",
      timezone: "America/Chicago",
      notes: "",
      addons: [],
      paused: false,
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: InsertScheduleRule) => {
      // Validate and adjust dtStart to match the selected weekday
      const startDate = new Date(data.dtStart);
      const targetDay = data.byDay;
      
      // Advance the start date until it matches the selected weekday
      while (startDate.getDay() !== targetDay) {
        startDate.setDate(startDate.getDate() + 1);
      }
      
      const adjustedData = {
        ...data,
        dtStart: startDate.toISOString().split("T")[0],
      };
      
      const response = await apiRequest("POST", "/api/schedule-rules", adjustedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-rules", customer.id] });
      toast({
        title: "Schedule Created",
        description: "Recurring schedule has been set up successfully.",
      });
      scheduleForm.reset();
    },
  });

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-schedule-${customer.id}`}>
          <Calendar className="w-3 h-3 mr-1" />
          Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recurring Service Schedule</DialogTitle>
          <DialogDescription>Set up automatic service scheduling for {customer.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Schedules */}
          {rulesLoading ? (
            <div className="text-center py-4">Loading schedules...</div>
          ) : scheduleRules && scheduleRules.length > 0 ? (
            <div className="space-y-2">
              <h3 className="font-medium">Current Schedules</h3>
              {scheduleRules.map((rule) => (
                <Card key={rule.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="font-medium capitalize">{rule.frequency}</div>
                      <div className="text-sm text-muted-foreground">
                        {dayNames[rule.byDay]} • {rule.windowStart} - {rule.windowEnd}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Starts: {rule.dtStart}
                      </div>
                      {rule.paused && (
                        <div className="text-xs text-orange-600 font-medium">Paused</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRuleMutation.mutate(rule.id)}
                      data-testid={`button-delete-rule-${rule.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No recurring schedules set up yet
            </div>
          )}

          {/* Add New Schedule Form */}
          <div className="border-t pt-6">
            <h3 className="font-medium mb-4">Add New Schedule</h3>
            <Form {...scheduleForm}>
              <form onSubmit={scheduleForm.handleSubmit((data) => createScheduleMutation.mutate(data))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={scheduleForm.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-frequency">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Biweekly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={scheduleForm.control}
                    name="byDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day of Week</FormLabel>
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger data-testid="select-day">
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {dayNames.map((day, index) => (
                              <SelectItem key={index} value={index.toString()}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={scheduleForm.control}
                  name="dtStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-start-date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={scheduleForm.control}
                    name="windowStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Window Start</FormLabel>
                        <FormControl>
                          <Input type="time" data-testid="input-window-start" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={scheduleForm.control}
                    name="windowEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Window End</FormLabel>
                        <FormControl>
                          <Input type="time" data-testid="input-window-end" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={scheduleForm.control}
                  name="paused"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-paused"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Pause Schedule
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setScheduleDialogOpen(false)}>
                    Close
                  </Button>
                  <Button type="submit" disabled={createScheduleMutation.isPending} className="bg-gradient-to-r from-[#2196F3] to-[#1DBF73]" data-testid="button-submit-schedule">
                    {createScheduleMutation.isPending ? "Creating..." : "Add Schedule"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Calculate next visit date from schedule rule - returns the Date object
function calculateNextVisitDate(rule: ScheduleRule): Date {
  // Use date-only comparison (set time to midnight)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startDate = new Date(rule.dtStart);
  startDate.setHours(0, 0, 0, 0);
  
  const period = rule.frequency === "weekly" ? 7 : 14;

  // Start from the dtStart date (first service date)
  let nextDate = new Date(startDate);
  
  // Advance by the period until we reach or pass today
  while (nextDate < today) {
    nextDate.setDate(nextDate.getDate() + period);
  }

  return nextDate;
}

// Format a visit date as a readable string
function formatNextVisit(date: Date, windowStart: string): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()} • ${windowStart}`;
}

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: allScheduleRules } = useQuery<ScheduleRule[]>({
    queryKey: ["/api/schedule-rules"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCustomer) => {
      const response = await apiRequest("POST", "/api/customers", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer Added",
        description: "New customer has been successfully added.",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertCustomer>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
      servicePlan: "weekly",
      numberOfDogs: 1,
      gateCode: "",
      yardNotes: "",
      status: "active",
      billingMethod: "invoice",
      smsOptIn: true,
    },
  });

  const [bestFitLoading, setBestFitLoading] = useState(false);
  const [bestFitSuggestions, setBestFitSuggestions] = useState<any[]>([]);

  const findBestFit = async () => {
    const address = form.getValues("address");
    if (!address) {
      toast({
        title: "Address Required",
        description: "Please enter a service address first",
        variant: "destructive",
      });
      return;
    }

    setBestFitLoading(true);
    try {
      const response = await apiRequest("POST", "/api/find-best-fit", { address });
      const data = await response.json();
      setBestFitSuggestions(data.suggestions);
      
      if (data.coordinates) {
        form.setValue("lat", data.coordinates.lat.toString());
        form.setValue("lng", data.coordinates.lng.toString());
      }

      toast({
        title: "Best Fit Calculated",
        description: `Found ${data.suggestions.length} route day suggestions`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not calculate best fit. Check address format.",
        variant: "destructive",
      });
    } finally {
      setBestFitLoading(false);
    }
  };

  const filteredCustomers = customers?.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

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
          <h1 className="text-4xl font-serif font-semibold bg-gradient-to-r from-[#2196F3] to-[#1DBF73] bg-clip-text text-transparent" data-testid="title-customers">
            Customers
          </h1>
          <p className="text-muted-foreground mt-1">Manage your customer database</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#2196F3] to-[#1DBF73]" data-testid="button-add-customer">
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
              <DialogDescription>Enter customer details to add them to your database</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" data-testid="input-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+1234567890" data-testid="input-phone" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" data-testid="input-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Address</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="123 Main St, City, State 12345" data-testid="input-address" {...field} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={findBestFit}
                          disabled={bestFitLoading || !field.value}
                          data-testid="button-find-best-fit"
                        >
                          <Navigation className="w-4 h-4 mr-1" />
                          {bestFitLoading ? "..." : "Find Best Fit"}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {bestFitSuggestions.length > 0 && (
                  <div className="bg-muted p-4 rounded-md space-y-2">
                    <h4 className="font-medium text-sm">Best Route Days (by proximity)</h4>
                    <div className="space-y-1">
                      {bestFitSuggestions.slice(0, 3).map((suggestion, index) => (
                        <div key={suggestion.dayOfWeek} className="text-sm flex items-center justify-between">
                          <span>
                            {index + 1}. {suggestion.dayName}
                            {suggestion.customerCount > 0 && ` (${suggestion.customerCount} nearby customers)`}
                          </span>
                          <span className="text-muted-foreground">
                            {suggestion.customerCount > 0 
                              ? `Avg ${suggestion.averageDistance.toFixed(1)} km` 
                              : "No customers on this day"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="servicePlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Plan</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-service-plan">
                              <SelectValue placeholder="Select plan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Biweekly</SelectItem>
                            <SelectItem value="one-time">One-Time</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="numberOfDogs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Dogs</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="8"
                            data-testid="input-dogs"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="gateCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gate Code (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="1234" data-testid="input-gate-code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="yardNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yard Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Special instructions, dog behaviors, yard layout..."
                          data-testid="input-yard-notes"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="billingMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-billing">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="invoice">Invoice</SelectItem>
                            <SelectItem value="card">Card on File</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="smsOptIn"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-sms-opt-in"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Send SMS Reminders
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Customer will receive night-before service reminders at 6 PM
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-[#2196F3] to-[#1DBF73]" data-testid="button-submit-customer">
                    {createMutation.isPending ? "Adding..." : "Add Customer"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search customers by name, address, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers && filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => {
            // Find active schedule rules for this customer
            const customerRules = allScheduleRules?.filter(rule => rule.customerId === customer.id && !rule.paused) || [];
            
            // Calculate the earliest upcoming visit across all active schedules
            let nextVisit: string | null = null;
            if (customerRules.length > 0) {
              const upcomingVisits = customerRules.map(rule => ({
                date: calculateNextVisitDate(rule),
                windowStart: rule.windowStart
              }));
              
              // Sort by date and pick the earliest
              upcomingVisits.sort((a, b) => a.date.getTime() - b.date.getTime());
              const earliest = upcomingVisits[0];
              nextVisit = formatNextVisit(earliest.date, earliest.windowStart);
            }

            return (
            <Card key={customer.id} className="hover-elevate" data-testid={`customer-card-${customer.id}`}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{customer.name}</h3>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block mt-1 ${
                      customer.status === "active" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {customer.status}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#1DBF73] flex items-center justify-center text-white font-semibold">
                    {customer.numberOfDogs}
                  </div>
                </div>

                {nextVisit && (
                  <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 p-2 rounded-lg">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">Next: {nextVisit}</span>
                  </div>
                )}
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="line-clamp-1">{customer.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span>{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="line-clamp-1">{customer.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="w-4 h-4 flex-shrink-0" />
                    <span className="capitalize">{customer.servicePlan.replace('-', ' ')}</span>
                  </div>
                </div>

                {customer.yardNotes && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground line-clamp-2">{customer.yardNotes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <ScheduleDialog customer={customer} />
                </div>
              </CardContent>
            </Card>
          )})
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No customers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
