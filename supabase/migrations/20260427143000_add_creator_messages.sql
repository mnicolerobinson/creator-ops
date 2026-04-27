DO $$ BEGIN
  CREATE TYPE creator_message_sender AS ENUM ('creator', 'operator');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.creator_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sender creator_message_sender NOT NULL,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_messages_client_created_idx
  ON public.creator_messages (client_id, created_at);

CREATE INDEX IF NOT EXISTS creator_messages_unread_operator_idx
  ON public.creator_messages (client_id)
  WHERE sender = 'operator' AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS creator_messages_unread_creator_idx
  ON public.creator_messages (client_id)
  WHERE sender = 'creator' AND read_at IS NULL;

ALTER TABLE public.creator_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_messages_select ON public.creator_messages;
CREATE POLICY creator_messages_select
  ON public.creator_messages FOR SELECT
  USING (current_user_has_client_access(client_id));

DROP POLICY IF EXISTS creator_messages_insert ON public.creator_messages;
CREATE POLICY creator_messages_insert
  ON public.creator_messages FOR INSERT
  WITH CHECK (current_user_has_client_access(client_id));

DROP POLICY IF EXISTS creator_messages_update ON public.creator_messages;
CREATE POLICY creator_messages_update
  ON public.creator_messages FOR UPDATE
  USING (current_user_has_client_access(client_id));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
