import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import OrgSetup from "./pages/OrgSetup";
import Dashboard from "./pages/Dashboard";
import ContentStudio from "./pages/ContentStudio";
import Campaigns from "./pages/Campaigns";
import CampaignBuilder from "./pages/CampaignBuilder";
import Schedule from "./pages/Schedule";
import BrandKit from "./pages/BrandKit";
import Marketplace from "./pages/Marketplace";
import Analytics from "./pages/Analytics";
import Integrations from "./pages/Integrations";
import Library from "./pages/Library";
import Usage from "./pages/Usage";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" />;
}

function RequiresOrgRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [hasOrg, setHasOrg] = useState<boolean | null>(null);

  useEffect(() => {
    checkOrgMembership();
  }, []);

  const checkOrgMembership = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setHasOrg(false);
        setLoading(false);
        return;
      }

      const { data: members, error } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (error) {
        console.error("Error checking org membership:", error);
        setHasOrg(false);
      } else {
        setHasOrg(members && members.length > 0);
      }
    } catch (error) {
      console.error("Error in checkOrgMembership:", error);
      setHasOrg(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  return hasOrg ? <>{children}</> : <Navigate to="/org-setup" />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/org-setup" element={<ProtectedRoute><OrgSetup /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><RequiresOrgRoute><Dashboard /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/content" element={<ProtectedRoute><RequiresOrgRoute><ContentStudio /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/campaigns" element={<ProtectedRoute><RequiresOrgRoute><Campaigns /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/campaigns/new" element={<ProtectedRoute><RequiresOrgRoute><CampaignBuilder /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/campaigns/:id/edit" element={<ProtectedRoute><RequiresOrgRoute><CampaignBuilder /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><RequiresOrgRoute><Schedule /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/brand-kit" element={<ProtectedRoute><RequiresOrgRoute><BrandKit /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/marketplace" element={<ProtectedRoute><RequiresOrgRoute><Marketplace /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><RequiresOrgRoute><Analytics /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/integrations" element={<ProtectedRoute><RequiresOrgRoute><Integrations /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><RequiresOrgRoute><Library /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/usage" element={<ProtectedRoute><RequiresOrgRoute><Usage /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><RequiresOrgRoute><Profile /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><RequiresOrgRoute><Settings /></RequiresOrgRoute></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
