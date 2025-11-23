import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Phone, Mail, MapPin, DollarSign, Calendar, Trash2, Navigation, Edit, Archive, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  insertCustomerSchema, 
  insertScheduleRuleSchema,
  type Customer, 
  type InsertCustomer,
  type ScheduleRule,
  type InsertScheduleRule,
  type ServiceType,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Utility function to check for missing critical customer information
function getIncompleteFields(customer: Customer): string[] {
  const missing: string[] = [];
  
  if (!customer.name || customer.name.trim() === "") missing.push("Name");
  if (!customer.address || customer.address.trim() === "") missing.push("Address");
  if (!customer.email || customer.email.trim() === "") missing.push("Email");
  if (!customer.phone || customer.phone.trim() === "") missing.push("Phone");
  if (!customer.serviceTypeId) missing.push("Service Type");
  
  return missing;
}

function hasIncompleteData(customer: Customer): boolean {
  return getIncompleteFields(customer).length > 0;
}

// Schedule Management Dialog Component
function ScheduleDialog({ customer }: { customer: Customer }) {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [bestFitSuggestions, setBestFitSuggestions] = useState<any[]>([]);
  const [loadingBestFit, setLoadingBestFit] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Schedule Removed",
        description: "The schedule has been deleted and all future routes have been removed.",
      });
    },
  });

  const scheduleForm = useForm<InsertScheduleRule>({
    resolver: zodResolver(insertScheduleRuleSchema),
    defaultValues: {
      customerId: customer.id,
      frequency: "weekly",
      byDay: customer.preferredDays && customer.preferredDays.length > 0 ? customer.preferredDays : [1], // Use customer's preferred days or default to Monday
      dtStart: new Date().toISOString().split("T")[0],
      windowStart: "08:00",
      windowEnd: "12:00",
      timezone: "America/Chicago",
      notes: "",
      addons: [],
      paused: false,
    },
  });

  // Reset form when dialog opens to use latest customer preferred days
  useEffect(() => {
    if (scheduleDialogOpen) {
      scheduleForm.reset({
        customerId: customer.id,
        frequency: "weekly",
        byDay: customer.preferredDays && customer.preferredDays.length > 0 ? customer.preferredDays : [1],
        dtStart: new Date().toISOString().split("T")[0],
        windowStart: "08:00",
        windowEnd: "12:00",
        timezone: "America/Chicago",
        notes: "",
        addons: [],
        paused: false,
      });
    }
  }, [scheduleDialogOpen, customer.preferredDays]);

  const createScheduleMutation = useMutation({
    mutationFn: async (data: InsertScheduleRule) => {
      console.log("📅 Schedule form data before submission:", data);
      console.log("📅 Selected days (byDay):", data.byDay);
      
      // Validate and adjust dtStart to match the first selected weekday
      const startDate = new Date(data.dtStart);
      const targetDay = data.byDay && data.byDay.length > 0 ? data.byDay[0] : 1;
      
      // Advance the start date until it matches the first selected weekday
      while (startDate.getDay() !== targetDay) {
        startDate.setDate(startDate.getDate() + 1);
      }
      
      const adjustedData = {
        ...data,
        dtStart: startDate.toISOString().split("T")[0],
      };
      
      console.log("📅 Adjusted data being sent to API:", adjustedData);
      console.log("📅 byDay in adjusted data:", adjustedData.byDay);
      
      const response = await apiRequest("POST", "/api/schedule-rules", adjustedData);
      return response.json();
    },
    onSuccess: async (data, variables) => {
      // Update customer's preferred days to match the schedule - only send preferredDays field
      try {
        await apiRequest("PATCH", `/api/customers/${customer.id}`, {
          preferredDays: variables.byDay || [],
        });
      } catch (error) {
        console.error("Failed to update customer preferred days:", error);
        toast({
          title: "Warning",
          description: "Schedule created but failed to save preferred days.",
          variant: "destructive",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-rules", customer.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      const routeCount = data.routesGenerated || 0;
      toast({
        title: "Schedule Created",
        description: `Recurring schedule has been set up successfully. ${routeCount} routes generated.`,
      });
      scheduleForm.reset();
      setBestFitSuggestions([]);
    },
  });

  const handleFindBestFit = async () => {
    setLoadingBestFit(true);
    try {
      const response = await apiRequest("POST", "/api/find-best-fit", {
        address: customer.address,
      });
      const data = await response.json();
      setBestFitSuggestions(data.suggestions || []);
      toast({
        title: "Best Fit Analysis Complete",
        description: "Recommended days based on your existing routes.",
      });
    } catch (error) {
      toast({
        title: "Unable to analyze",
        description: "Could not determine best fit days. You can still manually select days.",
        variant: "destructive",
      });
    } finally {
      setLoadingBestFit(false);
    }
  };

  const applyBestFitDays = (topN: number = 3) => {
    const recommendedDays = bestFitSuggestions
      .filter(s => s.customerCount > 0) // Only suggest days with existing customers
      .slice(0, topN)
      .map(s => s.dayOfWeek);
    
    if (recommendedDays.length > 0) {
      scheduleForm.setValue("byDay", recommendedDays);
      toast({
        title: "Days Applied",
        description: `Selected top ${recommendedDays.length} recommended days.`,
      });
    }
  };

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
                        {rule.byDay && rule.byDay.length > 0 
                          ? rule.byDay.map(day => dayNames[day]).join(", ")
                          : "No days selected"
                        } • {rule.windowStart} - {rule.windowEnd}
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
                            <SelectItem value="one-time">One-Time (Timer Billing)</SelectItem>
                            <SelectItem value="new-start">New Start (Timer Billing)</SelectItem>
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
                        <div className="flex items-center justify-between mb-2">
                          <FormLabel>Days of Week (Select 1-5)</FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleFindBestFit}
                            disabled={loadingBestFit}
                            data-testid="button-find-best-fit"
                          >
                            <Navigation className="w-3 h-3 mr-1" />
                            {loadingBestFit ? "Analyzing..." : "Find Best Fit"}
                          </Button>
                        </div>
                        
                        {bestFitSuggestions.length > 0 && (
                          <div className="mb-3 p-3 bg-muted rounded-md space-y-2">
                            <div className="text-sm font-medium">Recommended Days:</div>
                            <div className="flex flex-wrap gap-2">
                              {bestFitSuggestions.slice(0, 5).map((suggestion, idx) => (
                                <div
                                  key={suggestion.dayOfWeek}
                                  className={`text-xs px-2 py-1 rounded ${
                                    idx < 3 ? 'bg-primary/20 text-primary font-semibold' : 'bg-muted-foreground/10'
                                  }`}
                                >
                                  {suggestion.dayName}
                                  {suggestion.customerCount > 0 && (
                                    <span className="ml-1">({suggestion.customerCount} nearby)</span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => applyBestFitDays(3)}
                              className="w-full"
                              data-testid="button-apply-best-fit"
                            >
                              Apply Top 3 Days
                            </Button>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                          {dayNames.map((day, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Checkbox
                                id={`day-${index}`}
                                checked={field.value?.includes(index)}
                                onCheckedChange={(checked) => {
                                  const currentDays = field.value || [];
                                  console.log(`📅 Day ${day} (${index}) ${checked ? 'checked' : 'unchecked'}`);
                                  console.log(`📅 Current days before change:`, currentDays);
                                  
                                  if (checked) {
                                    // Add day if not already included (max 5 days)
                                    if (currentDays.length < 5 && !currentDays.includes(index)) {
                                      const newDays = [...currentDays, index].sort();
                                      console.log(`📅 New days after adding ${day}:`, newDays);
                                      field.onChange(newDays);
                                    } else if (currentDays.length >= 5) {
                                      console.log(`📅 Cannot add ${day} - maximum 5 days reached`);
                                    }
                                  } else {
                                    // Remove day
                                    const newDays = currentDays.filter(d => d !== index);
                                    console.log(`📅 New days after removing ${day}:`, newDays);
                                    field.onChange(newDays);
                                  }
                                }}
                                data-testid={`checkbox-day-${index}`}
                              />
                              <label
                                htmlFor={`day-${index}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {day}
                              </label>
                            </div>
                          ))}
                        </div>
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
                  <Button type="submit" disabled={createScheduleMutation.isPending} className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" data-testid="button-submit-schedule">
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
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived" | "incomplete">("active");
  const { toast } = useToast();
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: allScheduleRules } = useQuery<ScheduleRule[]>({
    queryKey: ["/api/schedule-rules"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCustomer) => {
      const payload: any = { 
        ...data,
        // Save service days to customer's preferred days (send empty array if none selected)
        preferredDays: scheduleDays.length > 0 ? scheduleDays : [],
      };
      
      // Include schedule data if days are selected
      if (scheduleDays.length > 0) {
        payload.schedule = {
          byDay: scheduleDays,
          windowStart: scheduleStartTime,
          windowEnd: scheduleEndTime,
          frequency: "weekly",
        };
      }
      
      const response = await apiRequest("POST", "/api/customers", payload);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/schedule-rules"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      const hadSchedule = scheduleDays.length > 0;
      
      // Reset state BEFORE closing dialog to prevent stale data
      setScheduleDays([]);
      setScheduleStartTime("08:00");
      setScheduleEndTime("12:00");
      form.reset();
      setEditingCustomer(null);
      
      toast({
        title: "Customer Added",
        description: hadSchedule 
          ? "Customer and schedule have been created. Routes will be generated automatically."
          : "New customer has been successfully added.",
      });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCustomer> }) => {
      const payload = {
        ...data,
        // Save service days to customer's preferred days (send empty array if none selected)
        preferredDays: scheduleDays.length > 0 ? scheduleDays : [],
      };
      const response = await apiRequest("PATCH", `/api/customers/${id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      // Reset state BEFORE closing dialog to prevent stale data
      setScheduleDays([]);
      setScheduleStartTime("08:00");
      setScheduleEndTime("12:00");
      form.reset();
      setEditingCustomer(null);
      
      toast({
        title: "Customer Updated",
        description: "Customer information has been updated.",
      });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/customers/${id}`, { status });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: variables.status === "active" ? "Customer Activated" : "Customer Archived",
        description: variables.status === "active" 
          ? "Customer has been reactivated." 
          : "Customer has been archived and won't appear in active lists.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update customer status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-rules"] });
      toast({
        title: "Customer Deleted",
        description: "Customer and all associated data have been permanently deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete customer: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const chargeMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const response = await apiRequest("POST", `/api/customers/${customerId}/charge`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: data.charged ? "Customer Charged" : "Invoice Created",
        description: data.message,
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

  // Form with extended schema for separate first/last name fields
  const formSchema = insertCustomerSchema.omit({ name: true }).extend({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      address: "",
      phone: "",
      email: "",
      serviceTypeId: undefined,
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
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleStartTime, setScheduleStartTime] = useState("08:00");
  const [scheduleEndTime, setScheduleEndTime] = useState("12:00");

  // Reset service days whenever dialog opens or editing customer changes
  useEffect(() => {
    if (dialogOpen) {
      if (editingCustomer) {
        setScheduleDays(editingCustomer.preferredDays || []);
      } else {
        setScheduleDays([]);
      }
    }
  }, [dialogOpen, editingCustomer]);

  // Stable initialization function for Google Maps Autocomplete
  const initializeAutocomplete = useCallback(() => {
    if (!addressInputRef.current || !window.google?.maps?.places) return;

    // Clear any existing autocomplete instance first
    if (autocompleteRef.current) {
      google.maps.event.clearInstanceListeners(autocompleteRef.current);
      autocompleteRef.current = null;
    }

    autocompleteRef.current = new google.maps.places.Autocomplete(addressInputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.formatted_address) {
        form.setValue('address', place.formatted_address);
        
        if (place.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          form.setValue('lat', lat.toString());
          form.setValue('lng', lng.toString());
        }
      }
    });
  }, [form]);

  // Load Google Maps script once
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    // Script already loaded
    if (window.google?.maps?.places) return;

    // Script is loading
    if (document.querySelector('script[src*="maps.googleapis.com"]')) return;

    // Load the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // Cleanup autocomplete when dialog closes
  useEffect(() => {
    if (!dialogOpen && autocompleteRef.current) {
      google.maps.event.clearInstanceListeners(autocompleteRef.current);
      autocompleteRef.current = null;
    }
  }, [dialogOpen]);

  // Callback ref that initializes autocomplete when input mounts
  const handleAddressInputRef = useCallback((node: HTMLInputElement | null) => {
    addressInputRef.current = node;
    if (node && dialogOpen && window.google?.maps?.places) {
      initializeAutocomplete();
    }
  }, [dialogOpen, initializeAutocomplete]);

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

  const filteredCustomers = customers?.filter((customer) => {
    // Apply status filter
    const statusMatch = statusFilter === "all" 
      ? true 
      : statusFilter === "active" 
        ? customer.status === "active"
        : statusFilter === "archived"
          ? customer.status === "inactive"
          : hasIncompleteData(customer); // incomplete filter
    
    // Apply search filter
    const searchMatch = searchTerm === "" || 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm);
    
    return statusMatch && searchMatch;
  });
  
  // Count customers with incomplete data
  const incompleteCustomersCount = customers?.filter(hasIncompleteData).length || 0;

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
          <h1 className="text-4xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent" data-testid="title-customers">
            Customers
          </h1>
          <p className="text-muted-foreground mt-1">Manage your customer database</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) {
            // Dialog closing - reset everything
            setEditingCustomer(null);
            form.reset();
            setScheduleDays([]);
            setScheduleStartTime("08:00");
            setScheduleEndTime("12:00");
          }
          setDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button 
              className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" 
              data-testid="button-add-customer"
              onClick={() => {
                // Clear editing state and reset form for new customer
                setEditingCustomer(null);
                form.reset({
                  firstName: "",
                  lastName: "",
                  address: "",
                  phone: "",
                  email: "",
                  serviceTypeId: undefined,
                  numberOfDogs: 1,
                  gateCode: "",
                  yardNotes: "",
                  status: "active",
                  billingMethod: "invoice",
                  smsOptIn: true,
                });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent 
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.pac-container')) {
                e.preventDefault();
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
              <DialogDescription>
                {editingCustomer ? "Update customer information" : "Enter customer details to add them to your database"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => {
                // Concatenate firstName and lastName into name
                const { firstName, lastName, ...rest } = data;
                const cleanedData: InsertCustomer = {
                  ...rest,
                  name: `${firstName} ${lastName}`.trim(),
                  lat: rest.lat === "" ? undefined : rest.lat,
                  lng: rest.lng === "" ? undefined : rest.lng,
                };
                
                if (editingCustomer) {
                  updateMutation.mutate({ id: editingCustomer.id, data: cleanedData });
                } else {
                  createMutation.mutate(cleanedData);
                }
              })} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" data-testid="input-first-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" data-testid="input-last-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                          <Input 
                            placeholder={import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? "Start typing your address..." : "123 Main St, City, State 12345"}
                            data-testid="input-address" 
                            {...field}
                            ref={(node) => {
                              field.ref(node);
                              handleAddressInputRef(node);
                            }}
                          />
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

                {/* Service Type Selection - REQUIRED */}
                <FormField
                  control={form.control}
                  name="serviceTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Type</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Auto-extract number of dogs from service type name
                          const selectedType = serviceTypes?.find(t => t.id === value);
                          if (selectedType) {
                            const match = selectedType.name.match(/^(\d+)\s+Dog/);
                            if (match) {
                              form.setValue("numberOfDogs", parseInt(match[1]));
                            }
                          }
                        }} 
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-service-type">
                            <SelectValue placeholder="Select service type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {serviceTypes
                            ?.sort((a, b) => {
                              // Sort by category, then by name
                              if (a.category < b.category) return -1;
                              if (a.category > b.category) return 1;
                              return a.name.localeCompare(b.name);
                            })
                            .map((type) => (
                            <SelectItem 
                              key={type.id} 
                              value={type.id}
                              data-testid={`select-option-${type.name.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {type.name} - ${type.basePrice}/visit
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Number of Dogs Field */}
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
                          max="20"
                          placeholder="1" 
                          data-testid="input-number-of-dogs"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Select service type above that matches number of dogs and frequency
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Schedule Configuration - only show when service type is selected */}
                {form.watch("serviceTypeId") && (
                  <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Schedule Configuration (Optional)</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Select service days and time window to auto-create schedule and routes
                      </p>
                    </div>

                    {/* Days of Week Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Service Days</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { day: 1, label: "Mon" },
                          { day: 2, label: "Tue" },
                          { day: 3, label: "Wed" },
                          { day: 4, label: "Thu" },
                          { day: 5, label: "Fri" },
                          { day: 6, label: "Sat" },
                          { day: 0, label: "Sun" },
                        ].map(({ day, label }) => (
                          <Button
                            key={day}
                            type="button"
                            variant={scheduleDays.includes(day) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setScheduleDays(prev =>
                                prev.includes(day)
                                  ? prev.filter(d => d !== day)
                                  : [...prev, day].sort((a, b) => a - b)
                              );
                            }}
                            data-testid={`button-day-${day}`}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Time Window */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Window Start</label>
                        <Input
                          type="time"
                          value={scheduleStartTime}
                          onChange={(e) => setScheduleStartTime(e.target.value)}
                          data-testid="input-schedule-start-time"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Window End</label>
                        <Input
                          type="time"
                          value={scheduleEndTime}
                          onChange={(e) => setScheduleEndTime(e.target.value)}
                          data-testid="input-schedule-end-time"
                        />
                      </div>
                    </div>
                  </div>
                )}

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
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setDialogOpen(false);
                      setEditingCustomer(null);
                      form.reset();
                    }} 
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending} 
                    className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" 
                    data-testid="button-submit-customer"
                  >
                    {editingCustomer 
                      ? (updateMutation.isPending ? "Updating..." : "Update Customer")
                      : (createMutation.isPending ? "Adding..." : "Add Customer")
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Incomplete Data Warning Banner */}
      {incompleteCustomersCount > 0 && statusFilter !== "incomplete" && (
        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20" data-testid="alert-incomplete-data">
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertTitle className="text-orange-900 dark:text-orange-100">Missing Customer Information</AlertTitle>
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            {incompleteCustomersCount} {incompleteCustomersCount === 1 ? "customer is" : "customers are"} missing critical information (name, address, email, phone, or service type).{" "}
            <button
              onClick={() => setStatusFilter("incomplete")}
              className="underline font-medium hover:no-underline"
              data-testid="link-view-incomplete"
            >
              View incomplete customers
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
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

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Show:</span>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={statusFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("active")}
              data-testid="filter-active"
            >
              Active ({customers?.filter(c => c.status === "active").length || 0})
            </Button>
            <Button
              variant={statusFilter === "archived" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("archived")}
              data-testid="filter-archived"
            >
              <Archive className="w-3 h-3 mr-1" />
              Archived ({customers?.filter(c => c.status === "inactive").length || 0})
            </Button>
            <Button
              variant={statusFilter === "incomplete" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("incomplete")}
              className={statusFilter === "incomplete" ? "" : "border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/20"}
              data-testid="filter-incomplete"
            >
              <AlertCircle className="w-3 h-3 mr-1" />
              Incomplete ({incompleteCustomersCount})
            </Button>
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              data-testid="filter-all"
            >
              All ({customers?.length || 0})
            </Button>
          </div>
        </div>
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

            const incompleteFields = getIncompleteFields(customer);
            const hasIncomplete = incompleteFields.length > 0;

            return (
            <Card key={customer.id} className={`hover-elevate ${hasIncomplete ? "border-orange-300 dark:border-orange-700" : ""}`} data-testid={`customer-card-${customer.id}`}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{customer.name}</h3>
                      {hasIncomplete && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-700 cursor-help" data-testid={`badge-incomplete-${customer.id}`}>
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Missing Data
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-semibold mb-1">Missing Information:</p>
                              <ul className="list-disc list-inside text-sm">
                                {incompleteFields.map(field => (
                                  <li key={field}>{field}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block mt-1 ${
                      customer.status === "active" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {customer.status}
                    </div>
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
                </div>

                {customer.yardNotes && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground line-clamp-2">{customer.yardNotes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  <ScheduleDialog customer={customer} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Charge ${customer.name} for their service?\n\nThis will create an invoice and charge them if they have autopay enabled.`)) {
                        chargeMutation.mutate(customer.id);
                      }
                    }}
                    disabled={chargeMutation.isPending || !customer.serviceTypeId}
                    className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] text-white border-0"
                    data-testid={`button-charge-${customer.id}`}
                  >
                    <DollarSign className="w-3 h-3 mr-1" />
                    Charge
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Split name into firstName and lastName for editing
                      const nameParts = customer.name.trim().split(' ');
                      const firstName = nameParts[0] || "";
                      const lastName = nameParts.slice(1).join(' ') || "";
                      
                      form.reset({
                        firstName,
                        lastName,
                        address: customer.address,
                        phone: customer.phone,
                        email: customer.email || "",
                        serviceTypeId: customer.serviceTypeId || undefined,
                        numberOfDogs: customer.numberOfDogs,
                        gateCode: customer.gateCode || "",
                        yardNotes: customer.yardNotes || "",
                        status: customer.status,
                        billingMethod: customer.billingMethod,
                        smsOptIn: customer.smsOptIn,
                        lat: customer.lat?.toString() || "",
                        lng: customer.lng?.toString() || "",
                      });
                      setEditingCustomer(customer);
                      setDialogOpen(true);
                    }}
                    data-testid={`button-edit-${customer.id}`}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateStatusMutation.mutate({
                        id: customer.id,
                        status: customer.status === "active" ? "inactive" : "active"
                      });
                    }}
                    disabled={updateStatusMutation.isPending}
                    data-testid={`button-archive-${customer.id}`}
                  >
                    {customer.status === "active" ? (
                      <>
                        <Archive className="w-3 h-3 mr-1" />
                        Archive
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Are you sure you want to permanently delete ${customer.name}? This cannot be undone.`)) {
                        deleteMutation.mutate(customer.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${customer.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )})
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">
              {searchTerm 
                ? "No customers match your search" 
                : statusFilter === "archived" 
                  ? "No archived customers" 
                  : statusFilter === "active"
                    ? "No active customers"
                    : statusFilter === "incomplete"
                      ? "No customers with incomplete data - great job!"
                      : "No customers found"
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
