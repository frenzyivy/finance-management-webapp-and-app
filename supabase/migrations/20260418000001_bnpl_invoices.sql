-- Migration: BNPL Invoice Upload & Storage
-- Date: 2026-04-18
-- Adds invoice_files column to bnpl_purchases, creates storage bucket + cleanup function

-- ============================================================
-- 1. Add invoice_files column to bnpl_purchases
-- ============================================================
-- Structure: [{ "path": "user_id/purchase_id/file.pdf", "name": "invoice.pdf",
--              "type": "order_invoice"|"emi_confirmation", "size": 1234,
--              "uploaded_at": "2026-04-18T10:00:00Z", "expires_at": "2026-08-16T10:00:00Z" }]
ALTER TABLE bnpl_purchases
ADD COLUMN IF NOT EXISTS invoice_files JSONB DEFAULT '[]'::JSONB;

-- ============================================================
-- 2. Storage bucket for BNPL invoices
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bnpl-invoices',
    'bnpl-invoices',
    FALSE,
    10485760,  -- 10MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Storage RLS policies (users can only access their own invoices)
-- ============================================================
-- Path structure: {user_id}/{purchase_id}/{filename}
-- So the first folder in the path must match the authenticated user's UUID

CREATE POLICY "Users can upload own bnpl invoices"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'bnpl-invoices'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

CREATE POLICY "Users can view own bnpl invoices"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'bnpl-invoices'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

CREATE POLICY "Users can delete own bnpl invoices"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'bnpl-invoices'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

CREATE POLICY "Users can update own bnpl invoices"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'bnpl-invoices'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

-- ============================================================
-- 4. Cleanup function: delete invoices older than 120 days
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_bnpl_invoices()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_record RECORD;
    v_file JSONB;
    v_cutoff_date TIMESTAMPTZ;
BEGIN
    v_cutoff_date := NOW() - INTERVAL '120 days';

    -- Find purchases with expired invoice files
    FOR v_record IN
        SELECT id, user_id, invoice_files
        FROM bnpl_purchases
        WHERE invoice_files IS NOT NULL
          AND jsonb_array_length(invoice_files) > 0
    LOOP
        -- Iterate through each file in the array
        FOR v_file IN SELECT * FROM jsonb_array_elements(v_record.invoice_files)
        LOOP
            IF (v_file->>'uploaded_at')::TIMESTAMPTZ < v_cutoff_date THEN
                -- Delete from storage
                DELETE FROM storage.objects
                WHERE bucket_id = 'bnpl-invoices'
                  AND name = v_file->>'path';

                v_deleted_count := v_deleted_count + 1;
            END IF;
        END LOOP;

        -- Remove expired entries from the JSONB array
        UPDATE bnpl_purchases
        SET invoice_files = (
            SELECT COALESCE(jsonb_agg(f), '[]'::JSONB)
            FROM jsonb_array_elements(v_record.invoice_files) f
            WHERE (f->>'uploaded_at')::TIMESTAMPTZ >= v_cutoff_date
        )
        WHERE id = v_record.id;
    END LOOP;

    RETURN jsonb_build_object(
        'deleted_files', v_deleted_count,
        'ran_at', NOW()
    );
END;
$$;
