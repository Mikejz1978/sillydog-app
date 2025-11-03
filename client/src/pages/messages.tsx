import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, User } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Message } from "@shared/schema";
import { format } from "date-fns";

export default function Messages() {
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const response = await fetch(`/api/messages?customerId=${selectedCustomerId}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!selectedCustomerId,
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { customerId: string; messageText: string }) => {
      return await apiRequest("POST", "/api/messages/send", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedCustomerId] });
      setMessageText("");
      toast({
        title: "Message Sent",
        description: "Your text message has been sent to the customer.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !messageText.trim()) return;
    
    sendMutation.mutate({
      customerId: selectedCustomerId,
      messageText: messageText.trim(),
    });
  };

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent">
          Messages
        </h1>
        <p className="text-muted-foreground mt-1">Communicate with your customers via SMS</p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
        {/* Customer List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Customers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {customers?.map((customer) => (
                <div key={customer.id}>
                  <button
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`w-full text-left p-4 hover-elevate active-elevate-2 transition-colors ${
                      selectedCustomerId === customer.id
                        ? "bg-gradient-to-r from-[#00BCD4]/10 to-[#FF6F00]/10"
                        : ""
                    }`}
                    data-testid={`button-customer-${customer.id}`}
                  >
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-muted-foreground">{customer.phone}</div>
                  </button>
                  <Separator />
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conversation View */}
        <Card className="md:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              {selectedCustomer ? selectedCustomer.name : "Select a customer"}
            </CardTitle>
            {selectedCustomer && (
              <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
            )}
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            {!selectedCustomerId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a customer to start messaging</p>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-muted-foreground">Loading messages...</p>
                    </div>
                  ) : messages && messages.length > 0 ? (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                          data-testid={`message-${message.id}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              message.direction === 'outbound'
                                ? 'bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] text-white'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm">{message.messageText}</p>
                            <p className={`text-xs mt-1 ${message.direction === 'outbound' ? 'text-white/70' : 'text-muted-foreground'}`}>
                              {format(new Date(message.sentAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <p>No messages yet. Start a conversation!</p>
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input */}
                <Separator />
                <form onSubmit={handleSendMessage} className="p-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="resize-none"
                      rows={2}
                      data-testid="input-message"
                    />
                    <Button
                      type="submit"
                      disabled={!messageText.trim() || sendMutation.isPending}
                      className="self-end"
                      data-testid="button-send"
                    >
                      {sendMutation.isPending ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Messages will be sent via SMS to {selectedCustomer?.phone}
                  </p>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
