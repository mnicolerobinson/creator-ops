-- Realtime INSERT on clients for ops console signup toasts (respects RLS).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
