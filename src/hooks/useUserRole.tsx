import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'owner' | 'admin' | 'editor' | 'member' | 'viewer';

export function useUserRole(orgId: string | null) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      setRole(null);
      setLoading(false);
      return;
    }

    async function fetchRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Server-side role fetch (protected by RLS)
        const { data, error } = await supabase
          .from('members')
          .select('role')
          .eq('user_id', user.id)
          .eq('org_id', orgId)
          .single();

        if (error) throw error;

        setRole(data?.role as UserRole);
      } catch (err) {
        console.error('Failed to fetch user role:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [orgId]);

  const isAdmin = role === 'owner' || role === 'admin';
  const isEditor = isAdmin || role === 'editor';
  const canManageMembers = isAdmin;
  const canEditContent = isEditor || role === 'member';

  return { role, loading, error, isAdmin, isEditor, canManageMembers, canEditContent };
}
