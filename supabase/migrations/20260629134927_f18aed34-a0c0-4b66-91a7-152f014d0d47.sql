
-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  streak_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============ tasks ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  urgency_score NUMERIC NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  risk_detected_at TIMESTAMPTZ,
  rescue_plan_generated BOOLEAN NOT NULL DEFAULT false,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  estimated_completion_probability NUMERIC NOT NULL DEFAULT 0.5,
  procrastination_risk NUMERIC NOT NULL DEFAULT 0,
  procrastination_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','missed')),
  deadline TIMESTAMPTZ,
  estimated_minutes INTEGER NOT NULL DEFAULT 60,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_user_deadline_idx ON public.tasks(user_id, deadline);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ subtasks ============
CREATE TABLE public.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  order_index INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX subtasks_task_idx ON public.subtasks(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subtasks TO authenticated;
GRANT ALL ON public.subtasks TO service_role;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their subtasks" ON public.subtasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ai_insights ============
CREATE TABLE public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('plan','rescue','brief','reflection','capture')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_insights_user_idx ON public.ai_insights(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their insights" ON public.ai_insights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ daily_briefs ============
CREATE TABLE public.daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_briefs TO authenticated;
GRANT ALL ON public.daily_briefs TO service_role;
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their briefs" ON public.daily_briefs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ reflections ============
CREATE TABLE public.reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary TEXT NOT NULL,
  completed_count INTEGER NOT NULL DEFAULT 0,
  missed_count INTEGER NOT NULL DEFAULT 0,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflections TO authenticated;
GRANT ALL ON public.reflections TO service_role;
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their reflections" ON public.reflections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ productivity_metrics ============
CREATE TABLE public.productivity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  productivity_score INTEGER NOT NULL DEFAULT 0,
  focus_minutes INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  missed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productivity_metrics TO authenticated;
GRANT ALL ON public.productivity_metrics TO service_role;
ALTER TABLE public.productivity_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their metrics" ON public.productivity_metrics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ agent_activity ============
CREATE TABLE public.agent_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX agent_activity_user_idx ON public.agent_activity(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_activity TO authenticated;
GRANT ALL ON public.agent_activity TO service_role;
ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their agent activity" ON public.agent_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert their agent activity" ON public.agent_activity FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ profile auto-create trigger ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
