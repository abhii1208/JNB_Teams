-- Update Demo User License Type
-- Run this to set the demo user as a licensed_admin

UPDATE users 
SET license_type = 'licensed_admin' 
WHERE email = 'JNBtest@JNB.com';

-- Verify the change
SELECT id, username, email, first_name, last_name, license_type, created_at 
FROM users 
WHERE email = 'JNBtest@JNB.com';
