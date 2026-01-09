-- Create user_passkeys table for WebAuthn/passkey credentials
CREATE TABLE public.user_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_name text,
  device_type text,
  transports jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  CONSTRAINT user_passkeys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create user_sessions table for session management
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL UNIQUE,
  device_name text,
  device_type text,
  browser text,
  os text,
  ip_address text,
  location text,
  is_current boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_active_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create backup_codes table for account recovery
CREATE TABLE public.backup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT backup_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create security_questions table for account recovery
CREATE TABLE public.security_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT security_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on all tables
ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_questions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_passkeys
CREATE POLICY "Users can view own passkeys"
ON public.user_passkeys FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own passkeys"
ON public.user_passkeys FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own passkeys"
ON public.user_passkeys FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own passkeys"
ON public.user_passkeys FOR DELETE
USING (user_id = auth.uid());

-- RLS policies for user_sessions
CREATE POLICY "Users can view own sessions"
ON public.user_sessions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
ON public.user_sessions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
ON public.user_sessions FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
ON public.user_sessions FOR DELETE
USING (user_id = auth.uid());

-- RLS policies for backup_codes
CREATE POLICY "Users can view own backup codes"
ON public.backup_codes FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own backup codes"
ON public.backup_codes FOR ALL
USING (user_id = auth.uid());

-- RLS policies for security_questions
CREATE POLICY "Users can view own security questions"
ON public.security_questions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own security questions"
ON public.security_questions FOR ALL
USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_user_passkeys_user_id ON public.user_passkeys(user_id);
CREATE INDEX idx_user_passkeys_credential_id ON public.user_passkeys(credential_id);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_last_active ON public.user_sessions(last_active_at DESC);
CREATE INDEX idx_backup_codes_user_id ON public.backup_codes(user_id);
CREATE INDEX idx_security_questions_user_id ON public.security_questions(user_id);