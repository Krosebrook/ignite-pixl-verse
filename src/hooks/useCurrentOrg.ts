/**
 * Hook to get the current user's organization
 * Centralizes org fetching logic used across many components
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrgData {
  orgId: string | null;
  role: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useCurrentOrg() {
  const [data, setData] = useState<OrgData>({
    orgId: null,
    role: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const loadOrg = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) {
            setData({ orgId: null, role: null, isLoading: false, error: null });
          }
          return;
        }

        const { data: membership, error } = await supabase
          .from('members')
          .select('org_id, role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (mounted) {
          setData({
            orgId: membership?.org_id ?? null,
            role: membership?.role ?? null,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (mounted) {
          setData(prev => ({
            ...prev,
            isLoading: false,
            error: error as Error,
          }));
        }
      }
    };

    loadOrg();

    return () => {
      mounted = false;
    };
  }, []);

  const isAdmin = data.role === 'owner' || data.role === 'admin';

  return { ...data, isAdmin };
}
