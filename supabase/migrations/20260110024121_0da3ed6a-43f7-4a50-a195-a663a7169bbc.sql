-- Create security_activity_log table for comprehensive activity tracking
CREATE TABLE public.security_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'login_attempt', 'login_success', 'login_failure', 'password_change', 'password_reset', 'mfa_enabled', 'mfa_disabled', 'passkey_added', 'passkey_removed', 'session_revoked', 'account_locked', 'account_unlocked', 'suspicious_activity'
  event_category TEXT NOT NULL DEFAULT 'security', -- 'security', 'auth', 'account'
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  location TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  failure_reason TEXT,
  risk_score INTEGER DEFAULT 0, -- 0-100 risk score for the event
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying by user and time
CREATE INDEX idx_security_activity_log_user_id ON public.security_activity_log(user_id);
CREATE INDEX idx_security_activity_log_created_at ON public.security_activity_log(created_at DESC);
CREATE INDEX idx_security_activity_log_event_type ON public.security_activity_log(event_type);
CREATE INDEX idx_security_activity_log_ip_address ON public.security_activity_log(ip_address);

-- Enable Row Level Security
ALTER TABLE public.security_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity logs
CREATE POLICY "Users can view their own activity logs"
ON public.security_activity_log
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert logs (edge functions)
CREATE POLICY "Service role can insert activity logs"
ON public.security_activity_log
FOR INSERT
WITH CHECK (true);

-- Create IP rate limit tracking table
CREATE TABLE public.ip_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  action TEXT NOT NULL, -- 'login_attempt', 'signup', etc.
  attempt_count INTEGER NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  block_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(ip_address, action)
);

-- Create index for IP lookups
CREATE INDEX idx_ip_rate_limits_ip_action ON public.ip_rate_limits(ip_address, action);
CREATE INDEX idx_ip_rate_limits_blocked_until ON public.ip_rate_limits(blocked_until);

-- Enable RLS on ip_rate_limits (no user access, edge functions only)
ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role only policies for IP rate limits
CREATE POLICY "Service role can manage IP rate limits"
ON public.ip_rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to check and update IP rate limit
CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
  p_ip_address TEXT,
  p_action TEXT,
  p_max_attempts INTEGER DEFAULT 10,
  p_window_minutes INTEGER DEFAULT 15,
  p_block_minutes INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.ip_rate_limits%ROWTYPE;
  v_now TIMESTAMP WITH TIME ZONE := now();
  v_window_start TIMESTAMP WITH TIME ZONE := v_now - (p_window_minutes || ' minutes')::INTERVAL;
  v_result JSONB;
BEGIN
  -- Get or create rate limit record
  SELECT * INTO v_record
  FROM public.ip_rate_limits
  WHERE ip_address = p_ip_address AND action = p_action
  FOR UPDATE;

  IF v_record.id IS NULL THEN
    -- First attempt from this IP
    INSERT INTO public.ip_rate_limits (ip_address, action, attempt_count, first_attempt_at, last_attempt_at)
    VALUES (p_ip_address, p_action, 1, v_now, v_now)
    RETURNING * INTO v_record;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_attempts - 1,
      'blocked_until', null,
      'attempt_count', 1
    );
  END IF;

  -- Check if currently blocked
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'blocked_until', v_record.blocked_until,
      'attempt_count', v_record.attempt_count,
      'block_reason', 'IP temporarily blocked due to too many failed attempts'
    );
  END IF;

  -- Check if window has expired (reset counter)
  IF v_record.first_attempt_at < v_window_start THEN
    UPDATE public.ip_rate_limits
    SET attempt_count = 1, first_attempt_at = v_now, last_attempt_at = v_now, blocked_until = NULL
    WHERE id = v_record.id;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_attempts - 1,
      'blocked_until', null,
      'attempt_count', 1
    );
  END IF;

  -- Increment attempt counter
  v_record.attempt_count := v_record.attempt_count + 1;

  IF v_record.attempt_count >= p_max_attempts THEN
    -- Block this IP
    v_record.blocked_until := v_now + (p_block_minutes * POWER(2, LEAST(v_record.block_count, 4)) || ' minutes')::INTERVAL;
    v_record.block_count := v_record.block_count + 1;
    
    UPDATE public.ip_rate_limits
    SET attempt_count = v_record.attempt_count,
        last_attempt_at = v_now,
        blocked_until = v_record.blocked_until,
        block_count = v_record.block_count
    WHERE id = v_record.id;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'blocked_until', v_record.blocked_until,
      'attempt_count', v_record.attempt_count,
      'block_reason', 'Too many attempts from this IP address'
    );
  END IF;

  -- Update attempt count
  UPDATE public.ip_rate_limits
  SET attempt_count = v_record.attempt_count, last_attempt_at = v_now
  WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_max_attempts - v_record.attempt_count,
    'blocked_until', null,
    'attempt_count', v_record.attempt_count
  );
END;
$$;

-- Function to reset IP rate limit (for successful login)
CREATE OR REPLACE FUNCTION public.reset_ip_rate_limit(
  p_ip_address TEXT,
  p_action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ip_rate_limits
  WHERE ip_address = p_ip_address AND action = p_action;
END;
$$;