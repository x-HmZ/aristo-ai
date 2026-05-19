-- 015_user_approval.sql
-- Approved-users-only gate. Placeholder for the future payment/subscription wall.
-- Until a user's profile is approved by an admin, middleware redirects them
-- to /pending and learner API routes reject their requests with 403.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  -- Set when we've successfully sent the admin "new signup" email so we
  -- don't spam on every callback / sign-in.
  ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_approval_status_idx
  ON profiles (approval_status);

-- Existing admins are auto-approved (admin implies approved).
UPDATE profiles
SET approval_status = 'approved',
    approved_at = NOW()
WHERE is_admin = true
  AND approval_status <> 'approved';
