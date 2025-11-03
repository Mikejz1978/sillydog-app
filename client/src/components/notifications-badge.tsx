import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCircle2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Notification, BookingRequest } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export function NotificationsBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Poll for unread notifications every 30 seconds
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications/unread"],
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const { data: pendingBookings = [] } = useQuery<BookingRequest[]>({
    queryKey: ["/api/booking-requests/pending"],
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const unreadCount = notifications.length;

  const markAsRead = async (notificationId: string) => {
    try {
      await apiRequest("PATCH", `/api/notifications/${notificationId}/read`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await Promise.all(
        notifications.map(n => apiRequest("PATCH", `/api/notifications/${n.id}/read`, {}))
      );
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "All notifications marked as read",
      });
    } catch (error) {
      toast({
        title: "Failed to mark notifications as read",
        variant: "destructive",
      });
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-notification-count"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end" data-testid="popover-notifications">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                data-testid="button-mark-all-read"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No new notifications</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {notifications.map((notification) => {
                  const booking = pendingBookings.find(
                    b => b.id === notification.bookingRequestId
                  );
                  
                  return (
                    <div
                      key={notification.id}
                      className="p-3 rounded-lg border bg-card hover-elevate"
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">
                                {notification.title}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {notification.message}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 -mt-1"
                              onClick={() => markAsRead(notification.id)}
                              data-testid={`button-dismiss-${notification.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {booking && (
                            <Link href="/bookings" onClick={() => setIsOpen(false)}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                data-testid={`button-view-booking-${booking.id}`}
                              >
                                View Booking Request
                              </Button>
                            </Link>
                          )}
                          {notification.smsDelivered && (
                            <Badge variant="secondary" className="text-xs mt-2">
                              SMS Sent
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {pendingBookings.length > 0 && (
            <div className="pt-4 border-t">
              <Link href="/bookings" onClick={() => setIsOpen(false)}>
                <Button
                  variant="default"
                  className="w-full"
                  data-testid="button-view-all-bookings"
                >
                  View All Pending Bookings ({pendingBookings.length})
                </Button>
              </Link>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
