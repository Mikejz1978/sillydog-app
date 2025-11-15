import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertServiceTypeSchema, type ServiceType, type InsertServiceType } from "@shared/schema";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, DollarSign, Calendar } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

const formSchema = insertServiceTypeSchema.omit({
  basePrice: true,
  pricePerExtraDog: true,
}).extend({
  basePrice: z.coerce.number().min(0.01, "Base price must be at least $0.01"),
  pricePerExtraDog: z.coerce.number().min(0, "Price per extra dog must be at least $0"),
});

export default function PriceBook() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [deletingService, setDeletingService] = useState<ServiceType | null>(null);

  const { data: serviceTypes, isLoading } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      frequency: "weekly",
      timesPerWeek: 1,
      basePrice: 0,
      pricePerExtraDog: 0,
      active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertServiceType) => {
      const res = await apiRequest("POST", "/api/service-types", data);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type created successfully" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertServiceType> }) => {
      const res = await apiRequest("PATCH", `/api/service-types/${id}`, data);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type updated successfully" });
      setEditingService(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/service-types/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type deleted successfully" });
      setDeletingService(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const data: InsertServiceType = {
      ...values,
      basePrice: values.basePrice.toString(),
      pricePerExtraDog: values.pricePerExtraDog.toString(),
    };

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (service: ServiceType) => {
    setEditingService(service);
    form.reset({
      name: service.name,
      description: service.description || "",
      category: service.category || "",
      frequency: service.frequency,
      timesPerWeek: service.timesPerWeek,
      basePrice: parseFloat(service.basePrice),
      pricePerExtraDog: parseFloat(service.pricePerExtraDog),
      active: service.active,
    });
  };

  const toggleActive = async (service: ServiceType) => {
    updateMutation.mutate({
      id: service.id,
      data: { active: !service.active },
    });
  };

  const getFrequencyLabel = (frequency: string, timesPerWeek: number) => {
    if (frequency === "weekly" && timesPerWeek === 1) return "Weekly";
    if (frequency === "biweekly" && timesPerWeek === 1) return "Biweekly";
    if (timesPerWeek > 1) return `${timesPerWeek}x per week`;
    return frequency;
  };

  // Group services by category
  const groupedServices = serviceTypes?.reduce((groups, service) => {
    const category = service.category || "Uncategorized";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(service);
    return groups;
  }, {} as Record<string, ServiceType[]>) || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Price Book</h1>
          <p className="text-muted-foreground mt-1">Manage your service catalog and pricing</p>
        </div>
        <Dialog
          open={isAddDialogOpen || !!editingService}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setEditingService(null);
              form.reset();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-service">
              <Plus className="h-4 w-4 mr-2" />
              Add Service Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingService ? "Edit Service Type" : "Add Service Type"}
              </DialogTitle>
              <DialogDescription>
                Define a new service type with pricing details
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Weekly Service, 3x Weekly"
                          data-testid="input-service-name"
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
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          placeholder="e.g., Keep it spotless with a weekly visit"
                          data-testid="input-service-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="e.g., Weekly Plans, 1 Dog Services"
                          data-testid="input-service-category"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          data-testid="select-frequency"
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Biweekly</SelectItem>
                            <SelectItem value="one-time">One-Time</SelectItem>
                            <SelectItem value="new-start">New Start</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="timesPerWeek"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Times Per Week</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                          data-testid="select-times-per-week"
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select times" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1x per week</SelectItem>
                            <SelectItem value="2">2x per week</SelectItem>
                            <SelectItem value="3">3x per week</SelectItem>
                            <SelectItem value="4">4x per week</SelectItem>
                            <SelectItem value="5">5x per week</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>For high-frequency services</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="basePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Price (1 Dog)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            placeholder="12.50"
                            data-testid="input-base-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pricePerExtraDog"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price Per Extra Dog</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            placeholder="1.00"
                            data-testid="input-price-per-dog"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Make this service available for customers
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setEditingService(null);
                      form.reset();
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-service"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingService
                      ? "Update Service"
                      : "Create Service"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading service types...</div>
      ) : !serviceTypes || serviceTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Service Types Yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first service type to the price book
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-service">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Service
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedServices).map(([category, services]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((service) => (
                  <Card key={service.id} className="hover-elevate" data-testid={`card-service-${service.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl">{service.name}</CardTitle>
                          <CardDescription className="mt-1">{service.description}</CardDescription>
                        </div>
                        <Badge variant={service.active ? "default" : "secondary"} data-testid={`badge-status-${service.id}`}>
                          {service.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-2" />
                          {getFrequencyLabel(service.frequency, service.timesPerWeek)}
                        </div>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                          <div className="text-sm">
                            <span className="font-semibold">${service.basePrice}</span>
                            <span className="text-muted-foreground"> / visit (1 dog)</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground ml-6">
                          +${service.pricePerExtraDog} per additional dog
                        </div>
                      </div>

                      <div className="pt-4 border-t flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive(service)}
                          disabled={updateMutation.isPending}
                          className="flex-1"
                          data-testid={`button-toggle-${service.id}`}
                        >
                          {service.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(service)}
                          data-testid={`button-edit-${service.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingService(service)}
                          data-testid={`button-delete-${service.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deletingService}
        onOpenChange={(open) => !open && setDeletingService(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingService?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingService && deleteMutation.mutate(deletingService.id)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
