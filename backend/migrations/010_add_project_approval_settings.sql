-- Add project-level approval settings for task closure workflow
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS admins_can_approve BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS only_owner_approves BOOLEAN DEFAULT false;

UPDATE projects
  SET admins_can_approve = true
  WHERE admins_can_approve IS NULL;

UPDATE projects
  SET only_owner_approves = false
  WHERE only_owner_approves IS NULL;
