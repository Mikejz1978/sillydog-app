import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBookingRequestSchema } from "@shared/schema";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, PawPrint } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type BookingFormData = z.infer<typeof insertBookingRequestSchema>;

export default function BookNow() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(insertBookingRequestSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      numberOfDogs: 1,
      preferredServicePlan: "",
      yardNotes: "",
      smsOptIn: false,
    },
  });

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.log('Google Maps API key not configured - address autocomplete disabled');
      return;
    }

    const loadGoogleMapsScript = () => {
      if (window.google?.maps?.places) {
        initAutocomplete();
        return;
      }

      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initAutocomplete;
      document.head.appendChild(script);
    };

    const initAutocomplete = () => {
      if (!addressInputRef.current || !window.google?.maps?.places) return;

      autocompleteRef.current = new google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.formatted_address) {
          form.setValue('address', place.formatted_address);
        }
      });
    };

    loadGoogleMapsScript();

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [form]);

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/public/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit booking");
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error("Booking error:", error);
      alert(error instanceof Error ? error.message : "Failed to submit booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            <CardTitle className="text-3xl font-fredoka">Booking Request Received!</CardTitle>
            <CardDescription className="text-lg mt-4">
              Thank you for choosing SillyDog Pooper Scooper Services!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base">
              We've received your booking request and will contact you shortly to schedule your service.
              You should receive a confirmation call or text within 24 hours.
            </p>
            <div className="pt-6">
              <Button
                onClick={() => {
                  setIsSubmitted(false);
                  form.reset();
                }}
                variant="outline"
                data-testid="button-book-another"
              >
                Submit Another Request
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2">
            <PawPrint className="h-8 w-8 text-[#00BCD4]" />
            <h1 className="text-2xl font-fredoka font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent">
              SillyDog Pooper Scooper
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-fredoka">Book a Service</CardTitle>
            <CardDescription className="text-base">
              Tell us about your yard and we'll get back to you with a customized service plan.
              All fields are required unless marked optional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Contact Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Smith"
                            data-testid="input-name"
                            {...field}
                          />
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
                          <Input
                            placeholder="(555) 123-4567"
                            data-testid="input-phone"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          We'll text or call to confirm your booking
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            data-testid="input-email"
                            {...field}
                            value={field.value || ""}
                          />
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
                        <FormControl>
                          <Input
                            placeholder="Start typing your address..."
                            data-testid="input-address"
                            {...field}
                            ref={(e) => {
                              field.ref(e);
                              (addressInputRef as any).current = e;
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          {import.meta.env.VITE_GOOGLE_MAPS_API_KEY 
                            ? "Start typing and select your address from the suggestions" 
                            : "Enter your complete service address"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Service Details */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-semibold">Service Details</h3>

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
                            data-testid="input-number-of-dogs"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredServicePlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Service Plan (Optional)</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                          data-testid="select-service-plan"
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-service-plan-trigger">
                              <SelectValue placeholder="Select a plan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly" data-testid="option-weekly">Weekly Service</SelectItem>
                            <SelectItem value="biweekly" data-testid="option-biweekly">Bi-Weekly Service</SelectItem>
                            <SelectItem value="one-time" data-testid="option-one-time">One-Time Cleanup</SelectItem>
                            <SelectItem value="new-start" data-testid="option-new-start">New Start (Initial Deep Clean)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Not sure? Leave blank and we'll help you choose
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="yardNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Gate code, special instructions, yard size, etc."
                            className="min-h-24"
                            data-testid="input-yard-notes"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Any details that would help us serve you better
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* SMS Consent - 10DLC Compliant Optional Opt-In */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-semibold">Communication Preferences</h3>
                  
                  <FormField
                    control={form.control}
                    name="smsOptIn"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-blue-50/50">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-sms-optin"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-base font-medium">
                            I agree to receive optional SMS messages
                          </FormLabel>
                          <FormDescription className="text-sm leading-relaxed">
                            I agree to receive optional SMS messages from Silly Dog Pooper Scooper, including service notifications, scheduling updates, and appointment reminders. Consent is optional and not required for service. Message & data rates may apply. Reply STOP to cancel, HELP for help. Your phone number will not be shared or sold.
                          </FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] hover:shadow-lg"
                  disabled={isSubmitting}
                  data-testid="button-submit-booking"
                >
                  {isSubmitting ? "Submitting..." : "Request Service"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Professional, reliable pet waste removal service
          </p>
          <p className="text-sm text-gray-600">
            Serving the community with care since 2020
          </p>
        </div>
      </main>
    </div>
  );
}
