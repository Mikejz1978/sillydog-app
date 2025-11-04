import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Bell, DollarSign, MapPin, CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";
import { useState, useEffect } from "react";

export default function Settings() {
  const { toast } = useToast();

  // Load settings
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [serviceRadius, setServiceRadius] = useState("");
  const [baseZipCode, setBaseZipCode] = useState("");

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setBusinessName(settings.businessName || "");
      setBusinessPhone(settings.businessPhone || "");
      setBusinessEmail(settings.businessEmail || "");
      setServiceRadius(settings.serviceRadius?.toString() || "");
      setBaseZipCode(settings.baseZipCode || "");
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<Settings>) => {
      return await apiRequest("PATCH", "/api/settings", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update settings. Please try again.",
      });
    },
  });

  const handleSaveBusinessInfo = () => {
    updateSettingsMutation.mutate({
      businessName,
      businessPhone,
      businessEmail,
    });
  };

  const handleSaveServiceArea = () => {
    updateSettingsMutation.mutate({
      serviceRadius: serviceRadius ? parseInt(serviceRadius) : null,
      baseZipCode,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent" data-testid="title-settings">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure your business preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Business Information
            </CardTitle>
            <CardDescription>Your company details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="business-name">Business Name</Label>
              <Input 
                id="business-name" 
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1" 
                data-testid="input-business-name" 
              />
            </div>
            <div>
              <Label htmlFor="phone">Business Phone</Label>
              <Input 
                id="phone" 
                placeholder="+1234567890" 
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                className="mt-1" 
                data-testid="input-business-phone" 
              />
            </div>
            <div>
              <Label htmlFor="email">Business Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="contact@sillydog.com" 
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                className="mt-1" 
                data-testid="input-business-email" 
              />
            </div>
            <Button 
              onClick={handleSaveBusinessInfo}
              disabled={updateSettingsMutation.isPending}
              className="w-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" 
              data-testid="button-save-business"
            >
              {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>Configure SMS notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">SMS: In Route</p>
                  <p className="text-xs text-muted-foreground">Notify customers when starting route</p>
                </div>
                <div className="w-12 h-6 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"></div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">SMS: Service Complete</p>
                  <p className="text-xs text-muted-foreground">Notify when service is finished</p>
                </div>
                <div className="w-12 h-6 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"></div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">SMS: Payment Received</p>
                  <p className="text-xs text-muted-foreground">Send receipt when payment is made</p>
                </div>
                <div className="w-12 h-6 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Pricing Configuration
            </CardTitle>
            <CardDescription>Service rate table</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-xs font-medium text-muted-foreground pb-2 border-b">
                <div>Plan</div>
                <div>1-2 Dogs</div>
                <div>3+ Dogs</div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm py-2">
                <div className="font-medium">Weekly</div>
                <div>$25-30</div>
                <div>$35-60</div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm py-2">
                <div className="font-medium">Biweekly</div>
                <div>$30-35</div>
                <div>$40-65</div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm py-2">
                <div className="font-medium">One-Time</div>
                <div>$50-60</div>
                <div>$70-120</div>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" data-testid="button-edit-pricing">
              Edit Pricing
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Service Area
            </CardTitle>
            <CardDescription>Coverage zones and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="service-radius">Service Radius (miles)</Label>
              <Input 
                id="service-radius" 
                type="number" 
                value={serviceRadius}
                onChange={(e) => setServiceRadius(e.target.value)}
                className="mt-1" 
                data-testid="input-service-radius" 
              />
            </div>
            <div>
              <Label htmlFor="base-zip-code">Base Location (ZIP)</Label>
              <Input 
                id="base-zip-code" 
                placeholder="12345" 
                value={baseZipCode}
                onChange={(e) => setBaseZipCode(e.target.value)}
                className="mt-1" 
                data-testid="input-base-location" 
              />
            </div>
            <Button 
              onClick={handleSaveServiceArea}
              disabled={updateSettingsMutation.isPending}
              variant="outline" 
              className="w-full" 
              data-testid="button-save-service-area"
            >
              {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Service Area
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Autopay & Billing
            </CardTitle>
            <CardDescription>Automatic monthly billing configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-sm">Monthly Billing Schedule</p>
                <p className="text-xs text-muted-foreground mt-1">Invoices generated on 1st of month at midnight CST</p>
                <p className="text-xs text-muted-foreground">Autopay charges processed immediately for enrolled customers</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-sm">SMS Reminder Schedule</p>
                <p className="text-xs text-muted-foreground mt-1">Night-before reminders sent daily at 6 PM CST</p>
                <p className="text-xs text-muted-foreground">Only sent to customers with SMS opt-in enabled</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="font-medium text-sm text-primary">Customer Autopay Setup</p>
                <p className="text-xs text-muted-foreground mt-1">Customers can enable autopay from their customer card</p>
                <p className="text-xs text-muted-foreground">Payment methods are securely stored via Stripe</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
