ALTER TABLE public.profiles
  ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';

UPDATE public.profiles
SET timezone = 'Asia/Kolkata',
    updated_at = now()
WHERE timezone IS NULL OR timezone = 'UTC';