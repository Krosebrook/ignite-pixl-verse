/**
 * Mobile navigation with bottom sheet menu
 */

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Menu,
  X,
} from "lucide-react";

const allNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, group: "Main" },
  { name: "Content Studio", href: "/content", icon: Sparkles, group: "Main" },
  { name: "Campaigns", href: "/campaigns", icon: LayoutGrid, group: "Main" },
  { name: "Schedule", href: "/schedule", icon: Calendar, group: "Main" },
  { name: "Brand Kit", href: "/brand-kit", icon: Palette, group: "Main" },
  { name: "Marketplace", href: "/marketplace", icon: ShoppingBag, group: "Tools" },
  { name: "Analytics", href: "/analytics", icon: BarChart3, group: "Tools" },
  { name: "Integrations", href: "/integrations", icon: Puzzle, group: "Tools" },
  { name: "Library", href: "/library", icon: Package, group: "Tools" },
  { name: "Usage", href: "/usage", icon: Activity, group: "System" },
  { name: "Monitoring", href: "/monitoring", icon: Monitor, group: "System" },
  { name: "Roadmap", href: "/roadmap", icon: Map, group: "System" },
  { name: "Profile", href: "/profile", icon: User, group: "Account" },
  { name: "Settings", href: "/settings", icon: Settings, group: "Account" },
];

const quickNav = allNavigation.slice(0, 4);

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const groupedNav = allNavigation.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, typeof allNavigation>);

  return (
    <>
      {/* Bottom quick nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border flex justify-around items-center py-2 z-40 safe-area-inset-bottom">
        {quickNav.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[60px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.name.split(' ')[0]}</span>
            </Link>
          );
        })}

        {/* More menu trigger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button 
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-muted-foreground min-w-[60px]"
              aria-label="More navigation options"
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
            <SheetHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <SheetTitle className="bg-gradient-hero bg-clip-text text-transparent">
                    FlashFusion
                  </SheetTitle>
                </div>
              </div>
            </SheetHeader>
            
            <ScrollArea className="h-full py-4">
              <div className="space-y-6 pb-20">
                {Object.entries(groupedNav).map(([group, items]) => (
                  <div key={group}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                      {group}
                    </h3>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-3 rounded-xl transition-all",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:bg-muted"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            <span>{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </nav>

      {/* Spacer for fixed bottom nav */}
      <div className="md:hidden h-20" />
    </>
  );
}
