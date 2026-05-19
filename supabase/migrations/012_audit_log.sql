-- ============================================================
-- Aristo AI — Migration 012: Admin Audit Log
-- ============================================================
-- Records every mutating administrative action. Write-only from
-- application code (service-role); admin UI reads via /api/admin/*.
--
-- Schema mirrors src/lib/admin/audit.ts AuditEntry exactly.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_email  TEXT,                              -- denormalized, survives profile delete
    action       TEXT        NOT NULL,              -- e.g. "course.publish", "user.promote_admin"
    target_type  TEXT,                              -- "course" | "user" | "concept" | "chunk" | ...
    target_id    TEXT,                              -- TEXT to support non-UUID ids (concepts)
    diff         JSONB       DEFAULT '{}'::jsonb,   -- { before, after } or { params }
    ip           INET,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor      ON public.admin_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON public.admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_target     ON public.admin_audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- service_role writes (from /api/admin/* routes) and reads (via the audit-log viewer).
-- No authenticated/anon policies exist — clients can never touch this table directly.
DROP POLICY IF EXISTS "audit service all" ON public.admin_audit_log;
CREATE POLICY "audit service all"
    ON public.admin_audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
