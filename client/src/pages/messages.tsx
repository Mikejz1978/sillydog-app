import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, User, PenSquare, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Message } from "@shared/schema";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Messages() {
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [composeSearchQuery, setComposeSearchQuery] = useState("");

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Sort customers alphabetically and filter by search
  const sortedCustomers = useMemo(() => {
    if (!customers) return [];
    return [...customers]
      .filter(c => c.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
      );
  }, [customers, searchQuery]);

  // Filter customers for compose dialog
  const composeFilteredCustomers = useMemo(() => {
    if (!customers) return [];
    return [...customers]
      .filter(c => c.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(c => 
        c.name.toLowerCase().includes(composeSearchQuery.toLowerCase()) ||
        c.phone.includes(composeSearchQuery)
      );
  }, [customers, composeSearchQuery]);

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent">
            Messages
          </h1>
          <p className="text-muted-foreground mt-1">Communicate with your customers via SMS</p>
        </div>
        
        {/* Compose New Message Button */}
        <Dialog open={composeDialogOpen} onOpenChange={setComposeDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-compose-message">
              <PenSquare className="w-4 h-4 mr-2" />
              Compose Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Compose New Message</DialogTitle>
              <DialogDescription>
                Select a customer to start a conversation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={composeSearchQuery}
                  onChange={(e) => setComposeSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-compose-search"
                />
              </div>
              <ScrollArea className="h-64">
                {composeFilteredCustomers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No customers found</p>
                ) : (
                  composeFilteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        setComposeDialogOpen(false);
                        setComposeSearchQuery("");
                      }}
                      className="w-full text-left p-3 hover-elevate rounded-md flex items-center gap-3"
                      data-testid={`compose-customer-${customer.id}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center text-white text-sm font-medium">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {/* Customer List */}
        <Card className="md:col-span-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Customers
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-customer-search"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {sortedCustomers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No customers found</p>
              ) : (
                sortedCustomers.map((customer) => (
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
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conversation View */}
        <Card className="md:col-span-2 flex flex-col overflow-hidden">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              {selectedCustomer ? selectedCustomer.name : "Select a customer"}
            </CardTitle>
            {selectedCustomer && (
              <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
            )}
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
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
                <ScrollArea className="flex-1 overflow-auto p-4">
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
                <Separator className="flex-shrink-0" />
                <form onSubmit={handleSendMessage} className="p-4 flex-shrink-0 bg-background">
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
