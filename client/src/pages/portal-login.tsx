import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogIn, UserPlus, Dog, Mail, Phone, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import logoImage from "@assets/logo_1762200437346.png";

export default function PortalLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("login");

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [setupForm, setSetupForm] = useState({
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/portal/login", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
      setLocation("/portal");
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (data: { email: string; phone: string; password: string }) => {
      const response = await apiRequest("POST", "/api/portal/setup-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Set Up!",
        description: "Your portal password has been created. You can now log in.",
      });
      setActiveTab("login");
      setLoginForm({ email: setupForm.email, password: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Unable to set up portal access",
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast({
        title: "Missing Information",
        description: "Please enter your email and password",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(loginForm);
  };

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!setupForm.email || !setupForm.phone || !setupForm.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (setupForm.password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (setupForm.password !== setupForm.confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    setupMutation.mutate({
      email: setupForm.email,
      phone: setupForm.phone,
      password: setupForm.password,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00BCD4]/10 via-background to-[#FF6F00]/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src={logoImage} 
            alt="SillyDog Logo" 
            className="w-24 h-24 mx-auto mb-4 object-contain"
            data-testid="img-portal-logo"
          />
          <h1 className="text-3xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent">
            Customer Portal
          </h1>
          <p className="text-muted-foreground mt-2">Access your account</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Welcome</CardTitle>
            <CardDescription className="text-center">
              Sign in to view your services, invoices, and more
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="tab-login">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="setup" data-testid="tab-setup">
                  <UserPlus className="w-4 h-4 mr-2" />
                  First Time?
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                        data-testid="input-login-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        className="pl-10"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        data-testid="input-login-password"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Sign In
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="setup" className="mt-6">
                <div className="mb-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  <Dog className="w-4 h-4 inline mr-2" />
                  First time accessing the portal? Set up your password using your email and phone number on file.
                </div>
                <form onSubmit={handleSetup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="setup-email">Email on File</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="setup-email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10"
                        value={setupForm.email}
                        onChange={(e) => setSetupForm({ ...setupForm, email: e.target.value })}
                        data-testid="input-setup-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-phone">Phone Number on File</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="setup-phone"
                        type="tel"
                        placeholder="(702) 555-1234"
                        className="pl-10"
                        value={setupForm.phone}
                        onChange={(e) => setSetupForm({ ...setupForm, phone: e.target.value })}
                        data-testid="input-setup-phone"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-password">Create Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="setup-password"
                        type="password"
                        placeholder="At least 6 characters"
                        className="pl-10"
                        value={setupForm.password}
                        onChange={(e) => setSetupForm({ ...setupForm, password: e.target.value })}
                        data-testid="input-setup-password"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="setup-confirm"
                        type="password"
                        placeholder="Confirm your password"
                        className="pl-10"
                        value={setupForm.confirmPassword}
                        onChange={(e) => setSetupForm({ ...setupForm, confirmPassword: e.target.value })}
                        data-testid="input-setup-confirm"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
                    disabled={setupMutation.isPending}
                    data-testid="button-setup"
                  >
                    {setupMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Setting Up...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Set Up Portal Access
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Need help? Call us at{" "}
          <a href="tel:7028774652" className="text-primary hover:underline">
            (702) 877-4652
          </a>
        </p>
      </div>
    </div>
  );
}
