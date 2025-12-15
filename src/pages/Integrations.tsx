import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Zap, ShoppingBag, FileText, HardDrive, RefreshCw, Trash2, Instagram, Twitter, Linkedin } from "lucide-react";
import { format } from "date-fns";

interface Integration {
  id: string;
  provider: string;
  status: string;
  expires_at: string | null;
  last_sync_at: string | null;
  metadata: any;
}

const providerInfo = {
  instagram: {
    name: "Instagram",
    icon: Instagram,
    description: "Schedule and publish posts to Instagram",
    color: "bg-gradient-to-r from-purple-500 to-pink-500",
  },
  twitter: {
    name: "Twitter / X",
    icon: Twitter,
    description: "Schedule and publish tweets to Twitter/X",
    color: "bg-black",
  },
  linkedin: {
    name: "LinkedIn",
    icon: Linkedin,
    description: "Schedule and publish updates to LinkedIn",
    color: "bg-blue-600",
  },
  shopify: {
    name: "Shopify",
    icon: ShoppingBag,
    description: "Connect your Shopify store to sync products and orders",
    color: "bg-green-500",
  },
  notion: {
    name: "Notion",
    icon: FileText,
    description: "Integrate with Notion for content management",
    color: "bg-gray-800",
  },
  google_drive: {
    name: "Google Drive",
    icon: HardDrive,
    description: "Access files from Google Drive",
    color: "bg-blue-500",
  },
  zapier: {
    name: "Zapier",
    icon: Zap,
    description: "Automate workflows with Zapier",
    color: "bg-orange-500",
  },
};

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadIntegrations();
    
    // Check for success callback
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    if (success) {
      toast({
        title: "Connected!",
        description: `Successfully connected to ${providerInfo[success as keyof typeof providerInfo]?.name || success}`,
      });
      // Clean URL
      window.history.replaceState({}, '', '/integrations');
    }
  }, []);

  const loadIntegrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's org
      const { data: membership } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) return;

      const { data, error } = await supabase
        .from('integrations')
        .select('id, org_id, provider, status, expires_at, last_sync_at, metadata, created_at, updated_at')
        .eq('org_id', membership.org_id);

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Load integrations error:', error);
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    try {
      const { data, error } = await supabase.functions.invoke('integrations-connect', {
        body: { provider },
      });

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Connect error:', error);
      toast({
        title: "Error",
        description: "Failed to initiate connection",
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) return;

      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('org_id', membership.org_id)
        .eq('provider', provider);

      if (error) throw error;

      toast({
        title: "Disconnected",
        description: `Disconnected from ${providerInfo[provider as keyof typeof providerInfo]?.name || provider}`,
      });

      loadIntegrations();
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect",
        variant: "destructive",
      });
    }
  };

  const getIntegrationStatus = (provider: string) => {
    return integrations.find(i => i.provider === provider);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect external services to enhance your workflow"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(providerInfo).map(([key, info]) => {
          const Icon = info.icon;
          const integration = getIntegrationStatus(key);
          const isConnected = !!integration && integration.status === 'connected';

          return (
            <Card key={key}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${info.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle>{info.name}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {info.description}
                      </CardDescription>
                    </div>
                  </div>
                  {isConnected && (
                    <Badge variant="default" className="bg-green-500">
                      Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {integration && (
                  <div className="text-sm space-y-2 text-muted-foreground">
                    {integration.last_sync_at && (
                      <p>
                        Last synced: {format(new Date(integration.last_sync_at), 'PPp')}
                      </p>
                    )}
                    {integration.expires_at && (
                      <p>
                        Expires: {format(new Date(integration.expires_at), 'PPp')}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  {!isConnected ? (
                    <Button
                      onClick={() => handleConnect(key)}
                      disabled={connecting === key}
                      className="w-full"
                    >
                      {connecting === key ? "Connecting..." : "Connect"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(key)}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisconnect(key)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Disconnect
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
