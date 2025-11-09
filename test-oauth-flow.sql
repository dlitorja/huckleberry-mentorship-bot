-- Test OAuth Flow
-- Insert a test pending join to simulate a Kajabi purchase
-- Use your own email address (the one associated with your Discord account)

INSERT INTO pending_joins (email, instructor_id, offer_id)
VALUES (
  'your-email@example.com',  -- REPLACE with your Discord account email
  '00f5fc23-60ad-4a3d-a153-e3ae5399b5ec',  -- First instructor from your list
  '2150278952'  -- First offer from your list
);

-- Verify it was inserted
SELECT * FROM pending_joins ORDER BY created_at DESC LIMIT 1;

