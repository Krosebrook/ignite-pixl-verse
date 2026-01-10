/**
 * Authentication hook with proper state management
 * Provides user authentication state and helper functions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
}

interface OrgMembership {
  org_id: string;
  role: string;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const [membership, setMembership] = useState<OrgMembership | null>(null);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (mounted) {
          setState({
            user: session?.user ?? null,
            session,
            isLoading: false,
            isAuthenticated: !!session?.user,
            error: null,
          });

          // Load org membership if authenticated (use maybeSingle to handle new users)
          if (session?.user) {
            const { data: memberData } = await supabase
              .from('members')
              .select('org_id, role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (mounted && memberData) {
              setMembership(memberData);
            }
          }
        }
      } catch (error) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: error as Error,
          }));
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        setState({
          user: session?.user ?? null,
          session,
          isLoading: false,
          isAuthenticated: !!session?.user,
          error: null,
        });

        if (session?.user) {
          const { data: memberData } = await supabase
            .from('members')
            .select('org_id, role')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (mounted && memberData) {
            setMembership(memberData);
          } else if (mounted) {
            setMembership(null);
          }
        } else {
          setMembership(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error }));
      throw error;
    }

    return data;
  }, []);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string, metadata?: Record<string, unknown>) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error }));
      throw error;
    }

    return data;
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error }));
      throw error;
    }

    setMembership(null);
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) throw error;
  }, []);

  // Update password
  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  }, []);

  // Memoized values
  const isAdmin = useMemo(() => 
    membership?.role === 'owner' || membership?.role === 'admin',
    [membership?.role]
  );

  const orgId = useMemo(() => membership?.org_id, [membership?.org_id]);

  return {
    ...state,
    membership,
    orgId,
    isAdmin,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth(redirectTo = '/auth') {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      window.location.href = redirectTo;
    }
  }, [auth.isLoading, auth.isAuthenticated, redirectTo]);

  return auth;
}
