/**
 * Collapsible sidebar navigation for desktop
 */

import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { 
  Zap, 
  Sparkles, 
  LayoutGrid, 
  Calendar, 
  ShoppingBag, 
  BarChart3, 
  Settings, 
  Puzzle, 
  Package, 
  Activity, 
  User, 
  Palette, 
  Monitor, 
  Map,
  Home,
  HelpCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mainNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Content Studio", href: "/content", icon: Sparkles },
  { name: "Campaigns", href: "/campaigns", icon: LayoutGrid },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Brand Kit", href: "/brand-kit", icon: Palette },
];

const toolsNavigation = [
  { name: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Integrations", href: "/integrations", icon: Puzzle },
  { name: "Library", href: "/library", icon: Package },
];

const systemNavigation = [
  { name: "Usage", href: "/usage", icon: Activity },
  { name: "Monitoring", href: "/monitoring", icon: Monitor },
  { name: "Roadmap", href: "/roadmap", icon: Map },
];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const NavItem = ({ item }: { item: typeof mainNavigation[0] }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.href;

    const content = (
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "transition-all",
          isActive && "bg-primary/10 text-primary font-medium"
        )}
      >
        <Link to={item.href}>
          <Icon className="h-4 w-4" />
          {!isCollapsed && <span>{item.name}</span>}
        </Link>
      </SidebarMenuButton>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">{item.name}</TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-3 group">
          <div className="relative flex-shrink-0">
            <Zap className="h-6 w-6 text-primary transition-transform group-hover:scale-110" />
            <div className="absolute inset-0 bg-primary/20 blur-xl group-hover:bg-primary/30 transition-all" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold bg-gradient-hero bg-clip-text text-transparent">
              FlashFusion
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <NavItem item={item} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <NavItem item={item} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <NavItem item={item} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <NavItem item={{ name: "Profile", href: "/profile", icon: User }} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <NavItem item={{ name: "Settings", href: "/settings", icon: Settings }} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
