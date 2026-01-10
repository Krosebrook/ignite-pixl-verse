/**
 * Hook for managing multiple organization memberships
 * Supports org switching with persistence
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OrgMembership {
  org_id: string;
  role: string;
  org: {
    id: string;
    name: string;
    slug: string;
  };
}

const SELECTED_ORG_KEY = 'ff_selected_org';

export function useMultiOrg() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SELECTED_ORG_KEY);
    }
    return null;
  });

  // Fetch all org memberships for the current user
  const {
    data: memberships,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['user-memberships'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('members')
        .select(`
          org_id,
          role,
          org:orgs(id, name, slug)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Type assertion for the joined data
      return (data as unknown as OrgMembership[]) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Set default org if none selected
  useEffect(() => {
    if (memberships && memberships.length > 0 && !selectedOrgId) {
      const firstOrg = memberships[0].org_id;
      setSelectedOrgId(firstOrg);
      localStorage.setItem(SELECTED_ORG_KEY, firstOrg);
    }
  }, [memberships, selectedOrgId]);

  // Validate selected org still exists in memberships
  useEffect(() => {
    if (memberships && selectedOrgId) {
      const isValid = memberships.some(m => m.org_id === selectedOrgId);
      if (!isValid && memberships.length > 0) {
        const firstOrg = memberships[0].org_id;
        setSelectedOrgId(firstOrg);
        localStorage.setItem(SELECTED_ORG_KEY, firstOrg);
      }
    }
  }, [memberships, selectedOrgId]);

  // Switch organization
  const switchOrg = useCallback((orgId: string) => {
    if (memberships?.some(m => m.org_id === orgId)) {
      setSelectedOrgId(orgId);
      localStorage.setItem(SELECTED_ORG_KEY, orgId);
      
      // Invalidate org-specific queries
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      queryClient.invalidateQueries({ queryKey: ['usage-credits'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
    }
  }, [memberships, queryClient]);

  // Current org details
  const currentOrg = useMemo(() => {
    if (!memberships || !selectedOrgId) return null;
    const membership = memberships.find(m => m.org_id === selectedOrgId);
    return membership?.org || null;
  }, [memberships, selectedOrgId]);

  // Current role
  const currentRole = useMemo(() => {
    if (!memberships || !selectedOrgId) return null;
    const membership = memberships.find(m => m.org_id === selectedOrgId);
    return membership?.role || null;
  }, [memberships, selectedOrgId]);

  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const hasMultipleOrgs = (memberships?.length ?? 0) > 1;

  return {
    memberships: memberships || [],
    selectedOrgId,
    currentOrg,
    currentRole,
    isAdmin,
    isLoading,
    error,
    hasMultipleOrgs,
    switchOrg,
  };
}
