import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        {/* Main content area */}
        <SidebarInset className="flex-1">
          {/* Desktop header with sidebar trigger */}
          <header className="hidden md:flex h-14 items-center gap-4 border-b border-border bg-card/50 backdrop-blur-sm px-4 sticky top-0 z-40">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
          </header>

          {/* Page content */}
          <main className="container mx-auto px-4 py-6 pb-24 md:pb-8">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </SidebarInset>

        {/* Mobile navigation */}
        <MobileNav />
      </div>
    </SidebarProvider>
  );
}
