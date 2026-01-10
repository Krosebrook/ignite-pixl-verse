/**
 * Organization hook for managing org-level data and operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type Org = Tables<'orgs'>;
type Member = Tables<'members'>;
type UsageCredits = Tables<'usage_credits'>;

export function useOrganization() {
  const { user, orgId, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch organization details
  const {
    data: organization,
    isLoading: isLoadingOrg,
    error: orgError,
  } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      
      const { data, error } = await supabase
        .from('orgs')
        .select('*')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      return data as Org;
    },
    enabled: !!orgId,
  });

  // Fetch organization members
  const {
    data: members,
    isLoading: isLoadingMembers,
  } = useQuery({
    queryKey: ['organization-members', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('members')
        .select(`
          *,
          profiles:profiles(display_name, avatar_url)
        `)
        .eq('org_id', orgId);

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Fetch usage credits
  const {
    data: usageCredits,
    isLoading: isLoadingUsage,
  } = useQuery({
    queryKey: ['usage-credits', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from('usage_credits')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) throw error;
      return data as UsageCredits | null;
    },
    enabled: !!orgId,
  });

  // Create organization
  const createOrganization = useMutation({
    mutationFn: async (data: { name: string; slug: string; timezone?: string; locale?: string }) => {
      const { data: orgId, error } = await supabase.rpc('create_org_with_owner', {
        p_name: data.name,
        p_slug: data.slug,
        p_timezone: data.timezone || 'UTC',
        p_locale: data.locale || 'en-US',
      });

      if (error) throw error;
      return orgId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
  });

  // Update organization
  const updateOrganization = useMutation({
    mutationFn: async (data: TablesUpdate<'orgs'>) => {
      if (!orgId) throw new Error('No organization');

      const { error } = await supabase
        .from('orgs')
        .update(data)
        .eq('id', orgId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
    },
  });

  // Invite member
  const inviteMember = useMutation({
    mutationFn: async (data: { userId: string; role: string }) => {
      if (!orgId || !user) throw new Error('No organization or user');

      const { error } = await supabase.from('members').insert({
        org_id: orgId,
        user_id: data.userId,
        role: data.role,
        granted_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', orgId] });
    },
  });

  // Update member role
  const updateMemberRole = useMutation({
    mutationFn: async (data: { memberId: string; role: string }) => {
      const { error } = await supabase
        .from('members')
        .update({ role: data.role })
        .eq('id', data.memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', orgId] });
    },
  });

  // Remove member
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', orgId] });
    },
  });

  // Usage helpers
  const usagePercentage = usageCredits
    ? Math.round((usageCredits.used_tokens / usageCredits.hard_limit_tokens) * 100)
    : 0;

  const videoMinutesRemaining = usageCredits
    ? (usageCredits.video_minutes_limit ?? 0) - (usageCredits.video_minutes_used ?? 0)
    : 0;

  const imageGenerationsRemaining = usageCredits
    ? (usageCredits.image_generations_limit ?? 0) - (usageCredits.image_generations_used ?? 0)
    : 0;

  return {
    organization,
    members,
    usageCredits,
    isLoading: isLoadingOrg || isLoadingMembers || isLoadingUsage,
    error: orgError,
    isAdmin,
    usagePercentage,
    videoMinutesRemaining,
    imageGenerationsRemaining,
    createOrganization,
    updateOrganization,
    inviteMember,
    updateMemberRole,
    removeMember,
  };
}
