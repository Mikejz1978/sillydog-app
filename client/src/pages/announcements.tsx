import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Megaphone, Send, Loader2, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

const announcementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  messageText: z.string().min(1, "Message text is required"),
});

type AnnouncementFormData = z.infer<typeof announcementSchema>;

type Announcement = {
  id: string;
  title: string;
  messageText: string;
  sentBy: string;
  totalRecipients: number;
  successfulSends: number;
  failedSends: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export default function Announcements() {
  const { toast } = useToast();
  
  const form = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: "",
      messageText: "",
    },
  });

  const { data: recipientCount } = useQuery<{ count: number }>({
    queryKey: ["/api/announcements/preview/count"],
  });

  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  const sendAnnouncementMutation = useMutation({
    mutationFn: async (data: AnnouncementFormData) => {
      const response = await apiRequest("POST", "/api/announcements", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements/preview/count"] });
      form.reset();
      toast({
        title: "Announcement Sent!",
        description: data.message || `Message sent to ${data.successfulSends} customers.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Send",
        description: error.message || "Could not send announcement. Please try again.",
      });
    },
  });

  const onSubmit = (data: AnnouncementFormData) => {
    if (!confirm(`Are you sure you want to send this message to ${recipientCount?.count || 0} customers?`)) {
      return;
    }
    sendAnnouncementMutation.mutate(data);
  };

  const getStatusBadge = (status: string, announcementId: string) => {
    switch (status) {
      case "completed":
        return <Badge data-testid={`badge-status-completed-${announcementId}`} variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "sending":
        return <Badge data-testid={`badge-status-sending-${announcementId}`} variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Sending</Badge>;
      case "failed":
        return <Badge data-testid={`badge-status-failed-${announcementId}`} variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge data-testid={`badge-status-pending-${announcementId}`} variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const messageText = form.watch("messageText");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Megaphone className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">
            Send bulk SMS messages to all customers
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send New Announcement
          </CardTitle>
          <CardDescription>
            This will send an SMS to all active customers who have opted in to receive messages.
            <span className="ml-2 font-semibold text-primary">
              {recipientCount?.count ?? 0} customers will receive this message.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title (for your reference)</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-announcement-title"
                        placeholder="e.g., Holiday Schedule Update"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="messageText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message Text</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="input-announcement-message"
                        placeholder="Enter your announcement message..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {messageText.length} characters
                      {messageText.length > 160 && " (will be sent as multiple SMS segments)"}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4 pt-4">
                <Button
                  type="submit"
                  data-testid="button-send-announcement"
                  disabled={sendAnnouncementMutation.isPending}
                  className="gap-2"
                >
                  {sendAnnouncementMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send to {recipientCount?.count ?? 0} Customers
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Announcement History
          </CardTitle>
          <CardDescription>
            View past announcements and their delivery status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : announcements?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No announcements sent yet.</p>
              <p className="text-sm">Your first announcement will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements?.map((announcement) => (
                <div
                  key={announcement.id}
                  data-testid={`announcement-item-${announcement.id}`}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{announcement.title}</h3>
                        {getStatusBadge(announcement.status, announcement.id)}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {announcement.messageText}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {announcement.totalRecipients} recipients
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      {announcement.successfulSends} sent
                    </span>
                    {announcement.failedSends > 0 && (
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-red-500" />
                        {announcement.failedSends} failed
                      </span>
                    )}
                    <span>
                      {format(new Date(announcement.createdAt), "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
