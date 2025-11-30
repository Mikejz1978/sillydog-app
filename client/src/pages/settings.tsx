import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Bell, DollarSign, MapPin, CreditCard, Loader2, Navigation, Route, MessageSquare } from "lucide-react";
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
  
  // Route optimization state
  const [routeStartAddress, setRouteStartAddress] = useState("");
  const [routeEndAddress, setRouteEndAddress] = useState("");
  const [isGeocodingStart, setIsGeocodingStart] = useState(false);
  const [isGeocodingEnd, setIsGeocodingEnd] = useState(false);
  
  // SMS message template state
  const [smsOnMyWayMessage, setSmsOnMyWayMessage] = useState("");
  const [smsServiceCompleteMessage, setSmsServiceCompleteMessage] = useState("");

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setBusinessName(settings.businessName || "");
      setBusinessPhone(settings.businessPhone || "");
      setBusinessEmail(settings.businessEmail || "");
      setServiceRadius(settings.serviceRadius?.toString() || "");
      setBaseZipCode(settings.baseZipCode || "");
      setRouteStartAddress(settings.routeStartAddress || "");
      setRouteEndAddress(settings.routeEndAddress || "");
      setSmsOnMyWayMessage(settings.smsOnMyWayMessage || "Hi {name}! Your SillyDog technician is on the way to {address}. We'll be there shortly! 🐕");
      setSmsServiceCompleteMessage(settings.smsServiceCompleteMessage || "Service complete at {address}! Your yard is all cleaned up. How did we do? Leave us a review: {reviewUrl}");
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

  // Geocode and save route optimization settings
  const handleSaveRouteOptimization = async () => {
    try {
      let startLat: string | null = null;
      let startLng: string | null = null;
      let endLat: string | null = null;
      let endLng: string | null = null;
      let geocodeError = false;
      
      // Geocode start address if provided
      if (routeStartAddress.trim()) {
        setIsGeocodingStart(true);
        try {
          const startResponse = await apiRequest("POST", "/api/geocode", { address: routeStartAddress });
          const startCoords = await startResponse.json();
          if (startCoords.lat && startCoords.lng) {
            startLat = String(startCoords.lat);
            startLng = String(startCoords.lng);
          } else {
            geocodeError = true;
            toast({
              variant: "destructive",
              title: "Start Address Not Found",
              description: "Could not find coordinates for the start address.",
            });
          }
        } catch {
          geocodeError = true;
        }
        setIsGeocodingStart(false);
      }
      
      // Geocode end address if provided
      if (routeEndAddress.trim()) {
        setIsGeocodingEnd(true);
        try {
          const endResponse = await apiRequest("POST", "/api/geocode", { address: routeEndAddress });
          const endCoords = await endResponse.json();
          if (endCoords.lat && endCoords.lng) {
            endLat = String(endCoords.lat);
            endLng = String(endCoords.lng);
          } else {
            geocodeError = true;
            toast({
              variant: "destructive",
              title: "End Address Not Found",
              description: "Could not find coordinates for the end address.",
            });
          }
        } catch {
          geocodeError = true;
        }
        setIsGeocodingEnd(false);
      }
      
      // Only save if at least one address was successfully geocoded, or if clearing addresses
      if (geocodeError && (routeStartAddress.trim() || routeEndAddress.trim())) {
        return; // Abort save if geocoding failed for provided addresses
      }
      
      // Save settings with coordinates
      updateSettingsMutation.mutate({
        routeStartAddress: routeStartAddress.trim() || null,
        routeStartLat: startLat,
        routeStartLng: startLng,
        routeEndAddress: routeEndAddress.trim() || null,
        routeEndLat: endLat,
        routeEndLng: endLng,
      });
    } catch (error) {
      setIsGeocodingStart(false);
      setIsGeocodingEnd(false);
      toast({
        variant: "destructive",
        title: "Geocoding Error",
        description: "Could not find coordinates for one or more addresses.",
      });
    }
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              SMS Message Templates
            </CardTitle>
            <CardDescription>
              Customize the text messages sent to customers. Use placeholders: <code className="bg-muted px-1 rounded">{"{name}"}</code> for customer name, <code className="bg-muted px-1 rounded">{"{address}"}</code> for address, <code className="bg-muted px-1 rounded">{"{reviewUrl}"}</code> for review link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="sms-on-my-way">"On My Way" Message</Label>
              <p className="text-xs text-muted-foreground mb-2">Sent when you tap "On My Way" for a route</p>
              <Textarea 
                id="sms-on-my-way" 
                value={smsOnMyWayMessage}
                onChange={(e) => setSmsOnMyWayMessage(e.target.value)}
                className="mt-1 min-h-[80px]" 
                data-testid="textarea-sms-on-my-way"
                placeholder="Hi {name}! Your SillyDog technician is on the way to {address}. We'll be there shortly! 🐕"
              />
            </div>
            <div>
              <Label htmlFor="sms-service-complete">"Service Complete" Message</Label>
              <p className="text-xs text-muted-foreground mb-2">Sent automatically when a service is marked complete</p>
              <Textarea 
                id="sms-service-complete" 
                value={smsServiceCompleteMessage}
                onChange={(e) => setSmsServiceCompleteMessage(e.target.value)}
                className="mt-1 min-h-[80px]" 
                data-testid="textarea-sms-service-complete"
                placeholder="Service complete at {address}! Your yard is all cleaned up. How did we do? Leave us a review: {reviewUrl}"
              />
            </div>
            <Button 
              onClick={() => updateSettingsMutation.mutate({ smsOnMyWayMessage, smsServiceCompleteMessage })}
              disabled={updateSettingsMutation.isPending}
              className="w-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" 
              data-testid="button-save-sms-templates"
            >
              {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Message Templates
            </Button>
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="w-5 h-5" />
              Route Optimization
            </CardTitle>
            <CardDescription>Set your starting and ending locations for route optimization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="route-start" className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-green-500" />
                  Start Location
                </Label>
                <Input 
                  id="route-start" 
                  placeholder="Enter your starting address" 
                  value={routeStartAddress}
                  onChange={(e) => setRouteStartAddress(e.target.value)}
                  className="mt-1" 
                  data-testid="input-route-start" 
                />
                <p className="text-xs text-muted-foreground mt-1">Where you start your day</p>
              </div>
              <div>
                <Label htmlFor="route-end" className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-red-500" />
                  End Location
                </Label>
                <Input 
                  id="route-end" 
                  placeholder="Enter your ending address" 
                  value={routeEndAddress}
                  onChange={(e) => setRouteEndAddress(e.target.value)}
                  className="mt-1" 
                  data-testid="input-route-end" 
                />
                <p className="text-xs text-muted-foreground mt-1">Where you end your day</p>
              </div>
            </div>
            {settings?.routeStartLat && settings?.routeEndLat && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">Route locations configured</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Optimization will use these locations when calculating the best route order.
                </p>
              </div>
            )}
            <Button 
              onClick={handleSaveRouteOptimization}
              disabled={updateSettingsMutation.isPending || isGeocodingStart || isGeocodingEnd}
              className="w-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]" 
              data-testid="button-save-route-optimization"
            >
              {(updateSettingsMutation.isPending || isGeocodingStart || isGeocodingEnd) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {isGeocodingStart || isGeocodingEnd ? "Finding Coordinates..." : "Save Route Settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
