import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, User, MapPin, Phone, Mail, Dog } from "lucide-react";
import { useState } from "react";
import type { BookingRequest } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Bookings() {
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: allBookings = [], isLoading } = useQuery<BookingRequest[]>({
    queryKey: ["/api/booking-requests"],
  });

  const pendingBookings = allBookings.filter(b => b.status === "pending");
  const completedBookings = allBookings.filter(b => b.status === "completed");
  const rejectedBookings = allBookings.filter(b => b.status === "rejected");

  const acceptMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return await apiRequest("PATCH", `/api/booking-requests/${bookingId}`, {
        status: "accepted",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Booking accepted",
        description: "Customer has been automatically created and added to your customer list.",
      });
      setShowAcceptDialog(false);
      setSelectedBooking(null);
    },
    onError: () => {
      toast({
        title: "Failed to accept booking",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return await apiRequest("PATCH", `/api/booking-requests/${bookingId}`, {
        status: "rejected",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Booking rejected",
      });
      setShowRejectDialog(false);
      setSelectedBooking(null);
    },
    onError: () => {
      toast({
        title: "Failed to reject booking",
        variant: "destructive",
      });
    },
  });

  const convertToCustomer = (booking: BookingRequest) => {
    // Navigate to customers page with pre-filled data in URL params
    const params = new URLSearchParams({
      fromBooking: "true",
      name: booking.name,
      address: booking.address,
      phone: booking.phone,
      email: booking.email || "",
      numberOfDogs: booking.numberOfDogs.toString(),
      yardNotes: booking.yardNotes || "",
      servicePlan: booking.preferredServicePlan || "",
      bookingId: booking.id,
    });
    setLocation(`/customers?${params.toString()}`);
  };

  const handleAccept = (booking: BookingRequest) => {
    setSelectedBooking(booking);
    setShowAcceptDialog(true);
  };

  const handleReject = (booking: BookingRequest) => {
    setSelectedBooking(booking);
    setShowRejectDialog(true);
  };

  const BookingCard = ({ booking }: { booking: BookingRequest }) => {
    const statusColors = {
      pending: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };

    return (
      <Card className="hover-elevate" data-testid={`booking-card-${booking.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{booking.name}</CardTitle>
              <CardDescription>
                Requested on {new Date(booking.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <Badge
              className={statusColors[booking.status as keyof typeof statusColors]}
              data-testid={`badge-status-${booking.id}`}
            >
              {booking.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{booking.address}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{booking.phone}</span>
            </div>
            {booking.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{booking.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Dog className="h-4 w-4 text-muted-foreground" />
              <span>{booking.numberOfDogs} dog(s)</span>
            </div>
          </div>

          {booking.preferredServicePlan && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Preferred Service Plan</p>
              <p className="text-sm text-muted-foreground capitalize">
                {booking.preferredServicePlan.replace("-", " ")}
              </p>
            </div>
          )}

          {booking.yardNotes && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Notes</p>
              <p className="text-sm text-muted-foreground">{booking.yardNotes}</p>
            </div>
          )}

          {booking.adminNotes && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium">Admin Notes</p>
              <p className="text-sm text-muted-foreground">{booking.adminNotes}</p>
            </div>
          )}

          {booking.status === "pending" && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleAccept(booking)}
                className="flex-1"
                data-testid={`button-accept-${booking.id}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Accept
              </Button>
              <Button
                onClick={() => handleReject(booking)}
                variant="destructive"
                className="flex-1"
                data-testid={`button-reject-${booking.id}`}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          )}

          {booking.customerId && (
            <Badge variant="secondary" className="w-full justify-center">
              Customer Created
            </Badge>
          )}
        </CardContent>
      </Card>
    );
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
      <div>
        <h1 className="text-4xl font-fredoka font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent" data-testid="title-bookings">
          Booking Requests
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage customer booking requests and convert them to active customers
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completedBookings.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            Rejected ({rejectedBookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingBookings.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">No pending booking requests</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedBookings.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">No completed booking requests</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {completedBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejectedBookings.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">No rejected booking requests</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {rejectedBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Accept Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent data-testid="dialog-accept-booking">
          <DialogHeader>
            <DialogTitle>Accept Booking Request?</DialogTitle>
            <DialogDescription>
              This will automatically create a customer record and mark the booking as completed. The customer will be added to your customer list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAcceptDialog(false)}
              data-testid="button-cancel-accept"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedBooking && acceptMutation.mutate(selectedBooking.id)}
              disabled={acceptMutation.isPending}
              data-testid="button-confirm-accept"
            >
              {acceptMutation.isPending ? "Accepting..." : "Accept Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent data-testid="dialog-reject-booking">
          <DialogHeader>
            <DialogTitle>Reject Booking Request?</DialogTitle>
            <DialogDescription>
              This will mark the booking as rejected. You can add admin notes to record the reason.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedBooking && rejectMutation.mutate(selectedBooking.id)}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
