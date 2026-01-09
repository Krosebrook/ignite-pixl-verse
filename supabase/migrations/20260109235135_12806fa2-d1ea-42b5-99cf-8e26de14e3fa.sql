-- Create table for TOTP 2FA secrets
CREATE TABLE public.user_totp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id)
);

-- Create table for login history/notifications
CREATE TABLE public.login_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device_name TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  location TEXT,
  is_new_device BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on user_totp
ALTER TABLE public.user_totp ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_totp
CREATE POLICY "Users can view their own TOTP settings"
  ON public.user_totp
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own TOTP settings"
  ON public.user_totp
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own TOTP settings"
  ON public.user_totp
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own TOTP settings"
  ON public.user_totp
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on login_history
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for login_history
CREATE POLICY "Users can view their own login history"
  ON public.login_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own login history"
  ON public.login_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX idx_login_history_created_at ON public.login_history(created_at DESC);
CREATE INDEX idx_user_totp_user_id ON public.user_totp(user_id);