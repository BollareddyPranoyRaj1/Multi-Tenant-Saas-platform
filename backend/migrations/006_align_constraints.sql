-- Align schema across reruns / existing volumes.
-- This project has evolved over time; older volumes may include stricter CHECK constraints.
-- These changes aim to make the schema compatible with the current app code.

-- Ensure task status/priority constraints exist (safe on fresh DB; noop on already-aligned DB)
DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'tasks_status_check'
        AND conrelid = 'public.tasks'::regclass
    ) THEN
      ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_status_check
        CHECK ((status)::text = ANY (ARRAY['todo','in_progress','done','cancelled']::text[]));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'tasks_priority_check'
        AND conrelid = 'public.tasks'::regclass
    ) THEN
      ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_priority_check
        CHECK ((priority)::text = ANY (ARRAY['low','medium','high','urgent']::text[]));
    END IF;
  END IF;
END $$;

-- Relax audit_logs constraints so app can record detailed actions.
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    -- Remove legacy action whitelist constraint if present
    EXECUTE 'ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check';

    -- Widen action to support detailed audit events (e.g., CREATE_PROJECT, REGISTER_TENANT, etc.)
    EXECUTE 'ALTER TABLE public.audit_logs ALTER COLUMN action TYPE VARCHAR(255)';

    -- Allow NULL entity_type for system/seed events (and match current code path)
    BEGIN
      EXECUTE 'ALTER TABLE public.audit_logs ALTER COLUMN entity_type DROP NOT NULL';
    EXCEPTION WHEN others THEN
      -- Ignore if already nullable
      NULL;
    END;

    EXECUTE 'ALTER TABLE public.audit_logs ALTER COLUMN entity_type TYPE VARCHAR(255)';
  END IF;
END $$;
