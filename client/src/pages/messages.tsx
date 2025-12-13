import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, User, PenSquare, Search, Menu, X, ArrowLeft } from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const isConversationSwitchRef = useRef<boolean>(false);

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Fetch all messages to get unread counts per customer
  const { data: allMessages } = useQuery<Message[]>({
    queryKey: ["/api/messages/all"],
    queryFn: async () => {
      const response = await fetch("/api/messages");
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
  });

  // Calculate unread counts and last message time per customer
  const customerMessageStats = useMemo(() => {
    const stats = new Map<string, { unreadCount: number; hasMessages: boolean; lastMessageTime: Date | null }>();
    if (!allMessages) return stats;
    
    allMessages.forEach((msg) => {
      const existing = stats.get(msg.customerId) || { unreadCount: 0, hasMessages: false, lastMessageTime: null };
      existing.hasMessages = true;
      
      // Count unread inbound messages (from customers)
      if (msg.direction === 'inbound' && !msg.readAt) {
        existing.unreadCount++;
      }
      
      // Track last message time for sorting
      const msgTime = new Date(msg.sentAt);
      if (!existing.lastMessageTime || msgTime > existing.lastMessageTime) {
        existing.lastMessageTime = msgTime;
      }
      
      stats.set(msg.customerId, existing);
    });
    
    return stats;
  }, [allMessages]);

  const sortedCustomers = useMemo(() => {
    if (!customers) return [];
    return [...customers]
      .filter(c => c.status === 'active')
      .filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
      )
      .sort((a, b) => {
        const statsA = customerMessageStats.get(a.id);
        const statsB = customerMessageStats.get(b.id);
        
        // Prioritize customers with unread messages
        const unreadA = statsA?.unreadCount || 0;
        const unreadB = statsB?.unreadCount || 0;
        if (unreadA !== unreadB) return unreadB - unreadA;
        
        // Then customers with any messages (sorted by most recent)
        const hasMessagesA = statsA?.hasMessages || false;
        const hasMessagesB = statsB?.hasMessages || false;
        if (hasMessagesA !== hasMessagesB) return hasMessagesB ? 1 : -1;
        
        if (hasMessagesA && hasMessagesB) {
          const timeA = statsA?.lastMessageTime?.getTime() || 0;
          const timeB = statsB?.lastMessageTime?.getTime() || 0;
          if (timeA !== timeB) return timeB - timeA;
        }
        
        // Finally alphabetical
        return a.name.localeCompare(b.name);
      });
  }, [customers, searchQuery, customerMessageStats]);

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

  useEffect(() => {
    const currentCount = messages?.length ?? 0;
    const prevCount = prevMessageCountRef.current;
    
    if (isConversationSwitchRef.current) {
      // On conversation switch, scroll instantly without animation
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      isConversationSwitchRef.current = false;
    } else if (currentCount > prevCount) {
      // Only smooth scroll when new messages arrive organically
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    
    prevMessageCountRef.current = currentCount;
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (data: { customerId: string; messageText: string }) => {
      return await apiRequest("POST", "/api/messages/send", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedCustomerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/all"] });
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

  // Mark messages as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return await apiRequest("POST", `/api/messages/mark-read/${customerId}`, {});
    },
    onSuccess: () => {
      // Refresh the all messages query to update unread counts
      queryClient.invalidateQueries({ queryKey: ["/api/messages/all"] });
    },
  });

  // Auto-select newest unread conversation on page load
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (!hasAutoSelected.current && sortedCustomers.length > 0 && customerMessageStats.size > 0) {
      // Find the first customer with unread messages (they're already sorted to top)
      const firstUnread = sortedCustomers.find(c => {
        const stats = customerMessageStats.get(c.id);
        return stats && stats.unreadCount > 0;
      });
      
      if (firstUnread) {
        setSelectedCustomerId(firstUnread.id);
        hasAutoSelected.current = true;
      } else if (sortedCustomers.length > 0) {
        // If no unread, select the first customer with recent messages
        const firstWithMessages = sortedCustomers.find(c => {
          const stats = customerMessageStats.get(c.id);
          return stats && stats.hasMessages;
        });
        if (firstWithMessages) {
          setSelectedCustomerId(firstWithMessages.id);
          hasAutoSelected.current = true;
        }
      }
    }
  }, [sortedCustomers, customerMessageStats]);

  // Mark messages as read when opening a conversation
  useEffect(() => {
    if (selectedCustomerId) {
      const stats = customerMessageStats.get(selectedCustomerId);
      if (stats && stats.unreadCount > 0) {
        markReadMutation.mutate(selectedCustomerId);
      }
    }
  }, [selectedCustomerId]);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSidebarOpen(false);
    prevMessageCountRef.current = 0; // Reset count for new conversation
    isConversationSwitchRef.current = true; // Flag for instant scroll
  };

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="overlay-sidebar-backdrop"
        />
      )}

      {/* Customer Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-background border-r transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:w-72 lg:w-80
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b flex items-center justify-between gap-2">
            <h2 className="font-semibold text-lg">Conversations</h2>
            <div className="flex items-center gap-2">
              <Dialog open={composeDialogOpen} onOpenChange={setComposeDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" data-testid="button-compose-message">
                    <PenSquare className="w-4 h-4" />
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
                              handleSelectCustomer(customer.id);
                              setComposeDialogOpen(false);
                              setComposeSearchQuery("");
                            }}
                            className="w-full text-left p-3 hover-elevate rounded-md flex items-center gap-3"
                            data-testid={`compose-customer-${customer.id}`}
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                              {customer.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{customer.name}</div>
                              <div className="text-sm text-muted-foreground">{customer.phone}</div>
                            </div>
                          </button>
                        ))
                      )}
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
              <Button 
                size="icon" 
                variant="ghost" 
                className="md:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-customer-search"
              />
            </div>
          </div>

          {/* Customer List */}
          <ScrollArea className="flex-1">
            {sortedCustomers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No customers found</p>
            ) : (
              sortedCustomers.map((customer) => {
                const stats = customerMessageStats.get(customer.id);
                const unreadCount = stats?.unreadCount || 0;
                const hasMessages = stats?.hasMessages || false;
                
                return (
                  <button
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer.id)}
                    className={`w-full text-left p-3 hover-elevate flex items-center gap-3 border-b ${
                      selectedCustomerId === customer.id
                        ? "bg-gradient-to-r from-[#00BCD4]/10 to-[#FF6F00]/10"
                        : ""
                    }`}
                    data-testid={`button-customer-${customer.id}`}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium truncate ${unreadCount > 0 ? 'font-semibold' : ''}`}>
                          {customer.name}
                        </span>
                        {hasMessages && unreadCount === 0 && (
                          <MessageSquare className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{customer.phone}</div>
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-muted/30">
        {/* Chat Header */}
        <div className="h-16 border-b bg-background flex items-center px-4 gap-3 flex-shrink-0">
          <Button 
            size="icon" 
            variant="ghost" 
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-open-sidebar"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          {selectedCustomer ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {selectedCustomer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{selectedCustomer.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
              </div>
            </div>
          ) : (
            <h2 className="font-semibold text-muted-foreground">Select a conversation</h2>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          {!selectedCustomerId ? (
            <div className="h-full flex items-center justify-center text-muted-foreground p-6">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">No conversation selected</p>
                <p className="text-sm">Choose a customer from the sidebar or compose a new message</p>
                <Button 
                  className="mt-4 md:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <User className="w-4 h-4 mr-2" />
                  View Customers
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3 min-h-full">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground">Loading messages...</p>
                  </div>
                ) : messages && messages.length > 0 ? (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        data-testid={`message-${message.id}`}
                      >
                        <div
                          className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                            message.direction === 'outbound'
                              ? 'bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] text-white rounded-br-md'
                              : 'bg-background border rounded-bl-md'
                          }`}
                        >
                          {message.direction === 'inbound' && selectedCustomer && (
                            <p className="text-xs font-semibold text-primary mb-1">{selectedCustomer.name}</p>
                          )}
                          {message.direction === 'outbound' && (
                            <p className="text-xs font-semibold text-white/90 mb-1">SillyDog</p>
                          )}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.messageText}</p>
                          <p className={`text-xs mt-2 ${message.direction === 'outbound' ? 'text-white/70' : 'text-muted-foreground'}`}>
                            {format(new Date(message.sentAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <p>No messages yet. Start a conversation!</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Message Input - Fixed at Bottom */}
        {selectedCustomerId && (
          <div className="border-t bg-background p-3 flex-shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
              <div className="flex-1">
                <Textarea
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="resize-none min-h-[44px] max-h-32"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  data-testid="input-message"
                />
              </div>
              <Button
                type="submit"
                size="icon"
                disabled={!messageText.trim() || sendMutation.isPending}
                className="h-11 w-11 flex-shrink-0"
                data-testid="button-send"
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 px-1">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
