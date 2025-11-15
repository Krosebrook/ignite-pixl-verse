import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkOnboardingStatus } from "@/lib/onboarding";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
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
import Pricing from "./pages/Pricing";

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

function RequiresOnboardingRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setOnboardingComplete(false);
        setLoading(false);
        return;
      }

      const status = await checkOnboardingStatus(user.id);
      setOnboardingComplete(status.onboardingComplete);
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      setOnboardingComplete(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  return onboardingComplete ? <>{children}</> : <Navigate to="/onboarding" />;
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
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><RequiresOnboardingRoute><Dashboard /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/content" element={<ProtectedRoute><RequiresOnboardingRoute><ContentStudio /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/campaigns" element={<ProtectedRoute><RequiresOnboardingRoute><Campaigns /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/campaigns/new" element={<ProtectedRoute><RequiresOnboardingRoute><CampaignBuilder /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/campaigns/:id/edit" element={<ProtectedRoute><RequiresOnboardingRoute><CampaignBuilder /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><RequiresOnboardingRoute><Schedule /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/brand-kit" element={<ProtectedRoute><RequiresOnboardingRoute><BrandKit /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/marketplace" element={<ProtectedRoute><RequiresOnboardingRoute><Marketplace /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><RequiresOnboardingRoute><Analytics /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/integrations" element={<ProtectedRoute><RequiresOnboardingRoute><Integrations /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><RequiresOnboardingRoute><Library /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/usage" element={<ProtectedRoute><RequiresOnboardingRoute><Usage /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><RequiresOnboardingRoute><Profile /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><RequiresOnboardingRoute><Settings /></RequiresOnboardingRoute></ProtectedRoute>} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
