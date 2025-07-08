-- SQL script to add unlimited demo API key
-- Run this directly on your Render Postgres database

-- Check if demo key already exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM accounts WHERE api_key = 'demo-unlimited-key-2024') 
        THEN 'Demo key already exists'
        ELSE 'Demo key does not exist - will insert'
    END as status;

-- Insert the demo key (only if it doesn't exist)
INSERT INTO accounts (api_key, email, created_at)
VALUES ('demo-unlimited-key-2024', 'demo@fileslap.com', NOW())
ON CONFLICT (api_key) DO NOTHING;

-- Verify the demo key was added
SELECT 
    api_key,
    email,
    created_at,
    'Demo key ready for unlimited usage' as status
FROM accounts 
WHERE api_key = 'demo-unlimited-key-2024'; 