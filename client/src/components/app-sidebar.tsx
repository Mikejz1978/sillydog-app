import { Home, Users, MapPin, FileText, Settings, LogOut, BarChart3, MessageSquare, Upload, CalendarCheck, DollarSign, Star, Shield, Eye, Megaphone } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import logoImage from "@assets/sillydog-logo.png";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Customers",
    url: "/customers",
    icon: Users,
  },
  {
    title: "Routes",
    url: "/routes",
    icon: MapPin,
  },
  {
    title: "Bookings",
    url: "/bookings",
    icon: CalendarCheck,
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  {
    title: "Announcements",
    url: "/announcements",
    icon: Megaphone,
  },
  {
    title: "Invoices",
    url: "/invoices",
    icon: FileText,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Reviews",
    url: "/reviews",
    icon: Star,
  },
  {
    title: "Price Book",
    url: "/price-book",
    icon: DollarSign,
  },
  {
    title: "Import",
    url: "/import",
    icon: Upload,
  },
  {
    title: "Portal Preview",
    url: "/portal-preview",
    icon: Eye,
  },
  {
    title: "User Management",
    url: "/users",
    icon: Shield,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  // Fetch unread message count for badge
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread-count'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const unreadCount = unreadData?.count || 0;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img 
            src={logoImage} 
            alt="SillyDog Logo" 
            className="w-12 h-12 object-contain"
            data-testid="img-logo"
          />
          <div>
            <h2 className="font-serif font-semibold text-base leading-tight">SillyDog</h2>
            <p className="text-xs text-muted-foreground">Pooper Scooper</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.title === "Messages" && unreadCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="ml-auto text-xs px-1.5 py-0.5 min-w-[20px] text-center"
                          data-testid="badge-unread-messages"
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <p className="text-xs text-muted-foreground">
          © 2025 SillyDog Services
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
