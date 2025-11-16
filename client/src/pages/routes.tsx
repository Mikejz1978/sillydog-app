import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Calendar, MapPin, Check, Navigation, Camera, Zap, RefreshCw, Ban, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRouteSchema, type Customer, type Route, type InsertRoute } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Stopwatch } from "@/components/stopwatch";
import { z } from "zod";

const skipRouteSchema = z.object({
  reason: z.string().min(1, "Please select a reason"),
  notes: z.string().optional(),
});

type SkipRouteFormData = z.infer<typeof skipRouteSchema>;

export default function Routes() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRouteForSkip, setSelectedRouteForSkip] = useState<Route | null>(null);
  const [selectedRouteForPhotos, setSelectedRouteForPhotos] = useState<Route | null>(null);
  const [routeToDelete, setRouteToDelete] = useState<Route | null>(null);
  const [photoBefore, setPhotoBefore] = useState<string>("");
  const [photoAfter, setPhotoAfter] = useState<string>("");
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: routes, isLoading } = useQuery<Route[]>({
    queryKey: ["/api/routes", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/routes?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch routes');
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertRoute) => {
      const response = await apiRequest("POST", "/api/routes", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Route Added",
        description: "New route has been scheduled.",
      });
      setDialogOpen(false);
      form.reset();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/routes/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Status Updated",
        description: "Route status has been updated.",
      });
    },
  });

  const uploadPhotosMutation = useMutation({
    mutationFn: async ({ jobHistoryId, photoBefore, photoAfter }: { jobHistoryId: string; photoBefore?: string; photoAfter?: string }) => {
      const response = await apiRequest("POST", `/api/job-history/${jobHistoryId}/photos`, { photoBefore, photoAfter });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-history"] });
      toast({
        title: "Photos Uploaded",
        description: "Before and after photos have been saved.",
      });
      setPhotoDialogOpen(false);
      setPhotoBefore("");
      setPhotoAfter("");
    },
  });

  const optimizeRoutesMutation = useMutation({
    mutationFn: async (date: string) => {
      const response = await apiRequest("POST", "/api/routes/optimize", { date });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Routes Optimized",
        description: "Routes have been reordered for efficiency.",
      });
    },
  });

  const generateRoutesMutation = useMutation({
    mutationFn: async (date: string) => {
      const response = await apiRequest("POST", "/api/routes/generate", { date });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Routes Generated",
        description: data.message || "Routes have been generated from schedules.",
      });
    },
  });

  const startTimerMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const response = await apiRequest("POST", `/api/routes/${routeId}/timer/start`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedDate] });
      toast({
        title: "Timer Started",
        description: "Service timer has been started.",
      });
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const response = await apiRequest("POST", `/api/routes/${routeId}/timer/stop`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/job-history"] });
      toast({
        title: "Timer Stopped",
        description: `Service took ${data.durationMinutes} minutes. Cost: $${data.calculatedCost.toFixed(2)}`,
      });
    },
  });

  const skipRouteMutation = useMutation({
    mutationFn: async ({ routeId, reason, notes }: { routeId: string; reason: string; notes?: string }) => {
      const response = await apiRequest("POST", `/api/routes/${routeId}/skip`, { reason, notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Route Skipped",
        description: "Customer will still be charged for this service.",
      });
      setSkipDialogOpen(false);
      skipForm.reset();
    },
  });

  const unskipRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const response = await apiRequest("POST", `/api/routes/${routeId}/unskip`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Route Restored",
        description: "Route has been restored to scheduled.",
      });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      await apiRequest("DELETE", `/api/routes/${routeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Route Deleted",
        description: "Route has been permanently removed from the schedule.",
      });
      setDeleteDialogOpen(false);
      setRouteToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete route. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Image must be less than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === 'before') {
        setPhotoBefore(base64);
      } else {
        setPhotoAfter(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!selectedRouteForPhotos) return;

    // Find corresponding job history entry
    const { data: jobHistory } = await queryClient.fetchQuery({
      queryKey: ["/api/job-history"],
    });
    
    const job = (jobHistory as any[])?.find(j => j.routeId === selectedRouteForPhotos.id);
    if (!job) {
      toast({
        title: "Error",
        description: "No job history found for this route.",
        variant: "destructive",
      });
      return;
    }

    uploadPhotosMutation.mutate({
      jobHistoryId: job.id,
      photoBefore: photoBefore || undefined,
      photoAfter: photoAfter || undefined,
    });
  };

  const form = useForm<InsertRoute>({
    resolver: zodResolver(insertRouteSchema),
    defaultValues: {
      date: selectedDate,
      customerId: "",
      scheduledTime: "",
      status: "scheduled",
      orderIndex: routes?.length || 0,
      serviceType: "regular",
    },
  });

  const skipForm = useForm<SkipRouteFormData>({
    resolver: zodResolver(skipRouteSchema),
    defaultValues: {
      reason: "",
      notes: "",
    },
  });

  const activeCustomers = customers?.filter(c => c.status === "active") || [];
  const sortedRoutes = routes?.sort((a, b) => a.orderIndex - b.orderIndex) || [];

  const handleStatusUpdate = (routeId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: routeId, status: newStatus });
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
          <h1 className="text-4xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent" data-testid="title-routes">
            Routes & Scheduling
          </h1>
          <p className="text-muted-foreground mt-1">Manage your daily service routes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" data-testid="button-add-route">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Route
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule New Route</DialogTitle>
              <DialogDescription>Add a customer to the route schedule</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-customer">
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeCustomers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} - {customer.address}
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
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Date</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Time (Optional)</FormLabel>
                      <FormControl>
                        <Input type="time" data-testid="input-time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-service-type">
                            <SelectValue placeholder="Select service type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="regular">Regular Service</SelectItem>
                          <SelectItem value="one-time">One-Time Service (Timer Billing)</SelectItem>
                          <SelectItem value="new-start">New Start (Timer Billing)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" data-testid="button-submit-route">
                    {createMutation.isPending ? "Scheduling..." : "Schedule Route"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
            data-testid="input-date-filter"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => generateRoutesMutation.mutate(selectedDate)}
            disabled={generateRoutesMutation.isPending}
            data-testid="button-generate-routes"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {generateRoutesMutation.isPending ? "Generating..." : "Generate Routes"}
          </Button>
          {sortedRoutes.length > 1 && (
            <Button
              variant="outline"
              onClick={() => optimizeRoutesMutation.mutate(selectedDate)}
              disabled={optimizeRoutesMutation.isPending}
              data-testid="button-optimize-routes"
            >
              <Zap className="w-4 h-4 mr-2" />
              {optimizeRoutesMutation.isPending ? "Optimizing..." : "Optimize Routes"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Route List
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedRoutes.length > 0 ? (
              <div className="space-y-3">
                {sortedRoutes.map((route, index) => {
                  const customer = customers?.find(c => c.id === route.customerId);
                  return (
                    <div
                      key={route.id}
                      className="p-4 rounded-lg border hover-elevate"
                      data-testid={`route-item-${route.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold">{customer?.name}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-1">{customer?.address}</p>
                          {route.scheduledTime && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Scheduled: {route.scheduledTime}
                            </p>
                          )}
                          {customer?.gateCode && (
                            <p className="text-xs font-medium mt-1 px-2 py-1 bg-muted rounded inline-block">
                              Gate: {customer.gateCode}
                            </p>
                          )}
                          
                          {/* Timer for one-time and new-start services */}
                          {(route.serviceType === "one-time" || route.serviceType === "new-start") && route.status === "in_route" && (
                            <div className="mt-3">
                              <Stopwatch
                                startTime={route.timerStartedAt}
                                onStart={() => startTimerMutation.mutate(route.id)}
                                onStop={() => stopTimerMutation.mutate(route.id)}
                                isStarted={!!route.timerStartedAt}
                                isStopped={!!route.timerStoppedAt}
                                showCost={true}
                                calculatedCost={route.calculatedCost}
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {/* Get Directions button - always visible */}
                            {customer?.address && (
                              <Button
                                size="sm"
                                variant="outline"
                                asChild
                                data-testid={`button-directions-${route.id}`}
                              >
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MapPin className="w-3 h-3 mr-1" />
                                  Directions
                                </a>
                              </Button>
                            )}
                            
                            {route.status === "scheduled" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleStatusUpdate(route.id, "in_route")}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-start-${route.id}`}
                                  className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
                                >
                                  <Navigation className="w-3 h-3 mr-1" />
                                  Start Route
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRouteForSkip(route);
                                    setSkipDialogOpen(true);
                                  }}
                                  data-testid={`button-skip-${route.id}`}
                                >
                                  <Ban className="w-3 h-3 mr-1" />
                                  Skip
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setRouteToDelete(route);
                                    setDeleteDialogOpen(true);
                                  }}
                                  data-testid={`button-delete-${route.id}`}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              </>
                            )}
                            {route.status === "in_route" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleStatusUpdate(route.id, "completed")}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-complete-${route.id}`}
                                  className="bg-gradient-to-r from-[#FF6F00] to-[#00BCD4]"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Complete Service
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRouteForPhotos(route);
                                    setPhotoDialogOpen(true);
                                  }}
                                  data-testid={`button-photo-${route.id}`}
                                >
                                  <Camera className="w-3 h-3 mr-1" />
                                  Photos
                                </Button>
                              </>
                            )}
                            {route.status === "skipped" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => unskipRouteMutation.mutate(route.id)}
                                disabled={unskipRouteMutation.isPending}
                                data-testid={`button-unskip-${route.id}`}
                              >
                                <Undo2 className="w-3 h-3 mr-1" />
                                Unskip
                              </Button>
                            )}
                            {route.status === "completed" && (
                              <div className="text-xs font-medium px-3 py-1 rounded-full bg-green-100 text-green-800">
                                Completed
                              </div>
                            )}
                            {route.status === "skipped" && (
                              <div className="text-xs font-medium px-3 py-1 rounded-full bg-orange-100 text-orange-800">
                                Skipped (Billable)
                              </div>
                            )}
                            <div className={`text-xs font-medium px-3 py-1 rounded-full ${
                              route.status === "in_route" 
                                ? "bg-blue-100 text-blue-800" 
                                : route.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : route.status === "skipped"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-gray-100 text-gray-800"
                            }`}>
                              {route.status === "in_route" ? "In Route" : route.status === "completed" ? "Done" : route.status === "skipped" ? "Skipped" : "Scheduled"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No routes scheduled for this date
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Route Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
              console.log('Google Maps API Key status:', apiKey ? 'Found!' : 'Missing');
              
              if (!apiKey) {
                return (
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground p-8">
                      <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">Google Maps API Key Required</p>
                      <p className="text-xs mt-2">Add VITE_GOOGLE_MAPS_API_KEY to Secrets, then restart the app</p>
                      <p className="text-xs mt-1 opacity-70">You may need to stop and start the workflow completely</p>
                    </div>
                  </div>
                );
              }
              
              if (sortedRoutes.length === 0) {
                return (
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground p-8">
                      <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No routes to display</p>
                      <p className="text-xs mt-2">Select a date with scheduled routes</p>
                    </div>
                  </div>
                );
              }
              
              return (
                <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                  <iframe
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${encodeURIComponent(customers?.find(c => c.id === sortedRoutes[0]?.customerId)?.address || 'Pahrump, NV')}&destination=${encodeURIComponent(customers?.find(c => c.id === sortedRoutes[sortedRoutes.length - 1]?.customerId)?.address || 'Pahrump, NV')}${sortedRoutes.length > 2 ? `&waypoints=${sortedRoutes.slice(1, -1).map(r => encodeURIComponent(customers?.find(c => c.id === r.customerId)?.address || '')).filter(Boolean).join('|')}` : ''}&mode=driving`}
                    title="Route Map"
                  />
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Photo Upload Dialog */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Before & After Photos</DialogTitle>
            <DialogDescription>
              Capture evidence of the completed service
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Before Photo</label>
              <input
                ref={beforeInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'before')}
                data-testid="input-photo-before"
              />
              {photoBefore ? (
                <div className="relative">
                  <img src={photoBefore} alt="Before" className="w-full h-48 object-cover rounded-lg" />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() => setPhotoBefore("")}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-32 border-dashed"
                  onClick={() => beforeInputRef.current?.click()}
                >
                  <Camera className="w-6 h-6 mr-2" />
                  Capture Before Photo
                </Button>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">After Photo</label>
              <input
                ref={afterInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'after')}
                data-testid="input-photo-after"
              />
              {photoAfter ? (
                <div className="relative">
                  <img src={photoAfter} alt="After" className="w-full h-48 object-cover rounded-lg" />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() => setPhotoAfter("")}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-32 border-dashed"
                  onClick={() => afterInputRef.current?.click()}
                >
                  <Camera className="w-6 h-6 mr-2" />
                  Capture After Photo
                </Button>
              )}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
              onClick={handlePhotoUpload}
              disabled={uploadPhotosMutation.isPending || (!photoBefore && !photoAfter)}
              data-testid="button-upload-photos"
            >
              {uploadPhotosMutation.isPending ? "Uploading..." : "Save Photos"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skip Route Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip Route</DialogTitle>
            <DialogDescription>
              Customer will still be charged for this service.
            </DialogDescription>
          </DialogHeader>
          <Form {...skipForm}>
            <form onSubmit={skipForm.handleSubmit((data) => {
              if (selectedRouteForSkip) {
                skipRouteMutation.mutate({
                  routeId: selectedRouteForSkip.id,
                  reason: data.reason,
                  notes: data.notes,
                });
              }
            })} className="space-y-4">
              <FormField
                control={skipForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-skip-reason">
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="customer_request">Customer Request</SelectItem>
                        <SelectItem value="weather">Weather</SelectItem>
                        <SelectItem value="no_access">No Access</SelectItem>
                        <SelectItem value="vacation">Vacation</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={skipForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional details..."
                        data-testid="textarea-skip-notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setSkipDialogOpen(false);
                    skipForm.reset();
                  }}
                  data-testid="button-cancel-skip"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={skipRouteMutation.isPending}
                  className="bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
                  data-testid="button-submit-skip"
                >
                  {skipRouteMutation.isPending ? "Skipping..." : "Skip Route"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteDialogOpen} 
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setRouteToDelete(null); // Clear state when dialog closes
        }}
      >
        <AlertDialogContent data-testid="dialog-delete-route">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this route for {routeToDelete && customers?.find(c => c.id === routeToDelete.customerId)?.name}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (routeToDelete) {
                  deleteRouteMutation.mutate(routeToDelete.id);
                }
              }}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
