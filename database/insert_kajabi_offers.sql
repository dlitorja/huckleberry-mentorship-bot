-- Insert Kajabi offer mappings
-- Run this in Supabase SQL Editor to map Kajabi offers to instructors

INSERT INTO kajabi_offers (offer_id, offer_name, instructor_id)
VALUES 
  ('2150278952', 'Kajabi Offer 2150278952', '00f5fc23-60ad-4a3d-a153-e3ae5399b5ec'),
  ('2150038950', 'Kajabi Offer 2150038950', 'cc6f0716-5d90-406e-b042-6b3eeabd4e91'),
  ('2150760681', 'Kajabi Offer 2150760681', '8c44345c-47d2-4d5c-bddf-d7cb5cb3cc7a'),
  ('2149680073', 'Kajabi Offer 2149680073', '12359533-b063-472a-b7d9-237c3f87e3ce'),
  ('2149759054', 'Kajabi Offer 2149759054', '80744b5f-cb7b-4af2-9656-43353db6482b'),
  ('2150036848', 'Kajabi Offer 2150036848', '15b52852-21d9-4d99-bee2-97aa8fa7820a'),
  ('2150525651', 'Kajabi Offer 2150525651', '39d553d5-e002-4c98-ad61-a9f02e1f853b'),
  ('2150414501', 'Kajabi Offer 2150414501', '697642e0-2e01-42b8-963e-78b1d873676a'),
  ('2150625097', 'Kajabi Offer 2150625097', 'ec7e5d99-9903-4f15-88bf-6021304ba9c3'),
  ('2150467479', 'Kajabi Offer 2150467479', '26fca68b-a680-41a6-ad77-59985b07449b')
ON CONFLICT (offer_id) 
DO UPDATE SET 
  instructor_id = EXCLUDED.instructor_id,
  updated_at = NOW();

-- Verify the inserts
SELECT 
  offer_id, 
  offer_name, 
  instructor_id,
  created_at
FROM kajabi_offers
ORDER BY offer_id;

