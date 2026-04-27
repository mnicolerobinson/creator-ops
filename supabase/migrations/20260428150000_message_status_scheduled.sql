-- Outbound drafts: approved → scheduled before send worker picks up.
DO $$
BEGIN
  ALTER TYPE message_status ADD VALUE 'scheduled';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
