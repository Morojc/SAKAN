-- ============================================================================
-- ADD ID CARD FIELD TO DOCUMENT SUBMISSIONS
-- Migration: 20251124200000_add_id_card_to_document_submissions.sql
-- Description: Adds id_card_url field to allow users to upload ID card for address verification
-- ============================================================================

ALTER TABLE dbasakan.syndic_document_submissions
  ADD COLUMN IF NOT EXISTS id_card_url text;

-- Add comment
COMMENT ON COLUMN dbasakan.syndic_document_submissions.id_card_url IS 'Supabase Storage path to the uploaded ID card document (to verify address matches procès verbal)';

