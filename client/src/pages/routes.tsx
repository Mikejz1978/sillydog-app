import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Calendar, MapPin, Check, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRouteSchema, type Customer, type Route, type InsertRoute } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Routes() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: routes, isLoading } = useQuery<Route[]>({
    queryKey: ["/api/routes", selectedDate],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertRoute) => {
      const response = await apiRequest("POST", "/api/routes", data);
      return response.json();
    },
    onSuccess: () => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Status Updated",
        description: "Route status has been updated.",
      });
    },
  });

  const form = useForm<InsertRoute>({
    resolver: zodResolver(insertRouteSchema),
    defaultValues: {
      date: selectedDate,
      customerId: "",
      scheduledTime: "",
      status: "scheduled",
      orderIndex: routes?.length || 0,
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
          <h1 className="text-4xl font-serif font-semibold bg-gradient-to-r from-[#2196F3] to-[#1DBF73] bg-clip-text text-transparent" data-testid="title-routes">
            Routes & Scheduling
          </h1>
          <p className="text-muted-foreground mt-1">Manage your daily service routes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#2196F3] to-[#1DBF73]" data-testid="button-add-route">
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
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-[#2196F3] to-[#1DBF73]" data-testid="button-submit-route">
                    {createMutation.isPending ? "Scheduling..." : "Schedule Route"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#2196F3] to-[#1DBF73] flex items-center justify-center text-white font-semibold flex-shrink-0">
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
                          <div className="flex items-center gap-2 mt-2">
                            {route.status === "scheduled" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleStatusUpdate(route.id, "in_route")}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-start-${route.id}`}
                                  className="bg-gradient-to-r from-[#2196F3] to-[#1DBF73]"
                                >
                                  <Navigation className="w-3 h-3 mr-1" />
                                  Start Route
                                </Button>
                              </>
                            )}
                            {route.status === "in_route" && (
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(route.id, "completed")}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`button-complete-${route.id}`}
                                className="bg-gradient-to-r from-[#1DBF73] to-[#2196F3]"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Complete Service
                              </Button>
                            )}
                            {route.status === "completed" && (
                              <div className="text-xs font-medium px-3 py-1 rounded-full bg-green-100 text-green-800">
                                Completed
                              </div>
                            )}
                            <div className={`text-xs font-medium px-3 py-1 rounded-full ${
                              route.status === "in_route" 
                                ? "bg-blue-100 text-blue-800" 
                                : route.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}>
                              {route.status === "in_route" ? "In Route" : route.status === "completed" ? "Done" : "Scheduled"}
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
                No routes scheduled for this date 🐾
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
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground p-8">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Map view coming soon!</p>
                <p className="text-xs mt-2">Route optimization and live GPS tracking</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
