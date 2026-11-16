-- ============================================================
-- Aristo AI — Migration 019: narration cache kind
-- ============================================================
-- /api/tts now stores the ElevenLabs result of LESSON narration (never live
-- chat) in the public `generated-assets` bucket at tts/<hash>.mp3 with the
-- character alignment next to it at tts/<hash>.json, and records the mp3 in
-- generated_assets with kind 'tts_audio' (prompt_hash = the SHA-256 key).
--
-- This widens the kind CHECK from migration 016. The constraint is dropped by
-- looking it up on the catalog, so the script is safe to re-run and does not
-- depend on the auto-generated name.
-- RLS from 016 is unchanged.
-- ============================================================

DO $$
DECLARE
    con RECORD;
BEGIN
    FOR con IN
        SELECT c.conname
          FROM pg_constraint c
         WHERE c.conrelid = 'public.generated_assets'::regclass
           AND c.contype  = 'c'
           AND pg_get_constraintdef(c.oid) ILIKE '%kind%'
    LOOP
        EXECUTE format('ALTER TABLE public.generated_assets DROP CONSTRAINT %I', con.conname);
    END LOOP;
END $$;

-- Keep every kind written by earlier migrations and code, then add the new one.
ALTER TABLE public.generated_assets
    ADD CONSTRAINT generated_assets_kind_check
    CHECK (kind IN ('infographic', 'flux_source', 'model_3d', 'tts_audio'));
