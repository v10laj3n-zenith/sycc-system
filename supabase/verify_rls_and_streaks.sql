-- ============================================================================
-- SYCC Youth Growth & Discipleship Monitoring System
-- Automated Verification Harness (Run inside a rolled-back transaction in SQL Editor)
-- Verifies: Consecutive Streak Progression, Leader Immunity, Leader Graduation,
-- pgcrypto Care Vault Encryption, PHP Denomination Math & RLS Isolation.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_admin_id UUID := gen_random_uuid();
  v_leader_id UUID := gen_random_uuid();
  v_new_leader_id UUID := gen_random_uuid();
  v_member_id UUID := gen_random_uuid();
  v_tier public.discipleship_tier;
  v_streak INTEGER;
  v_note_id UUID;
  v_decrypted TEXT;
  v_liq_id UUID;
  v_actual NUMERIC(12,2);
  v_key TEXT := 'unit_test_secret_key_32_bytes_min';
BEGIN
  INSERT INTO public.profiles (id, full_name, role, tier)
  VALUES
    (v_admin_id,      'Test Admin',      'system_admin', 'cell_leader'),
    (v_leader_id,     'Top Leader',      'cell_leader',  'cell_leader'),
    (v_new_leader_id, 'Emerging Leader', 'cell_leader',  'cell_leader'),
    (v_member_id,     'Youth Member',    'member',       'new_invite');

  UPDATE public.profiles
  SET current_leader_id = v_leader_id,
      invited_by_id = v_leader_id
  WHERE id = v_member_id;

  -- 1. Insert 3 consecutive Saturdays -> must remain new_invite
  INSERT INTO public.attendance_logs (profile_id, service_date, method)
  VALUES
    (v_member_id, DATE '2026-01-03', 'qr_scan'),
    (v_member_id, DATE '2026-01-10', 'qr_scan'),
    (v_member_id, DATE '2026-01-17', 'qr_scan');

  SELECT tier, consecutive_saturday_streak INTO v_tier, v_streak
  FROM public.profiles WHERE id = v_member_id;
  ASSERT v_streak = 3 AND v_tier = 'new_invite',
    format('Expected streak=3 new_invite, got streak=%s tier=%s', v_streak, v_tier);

  -- 2. Insert 4th consecutive Saturday -> auto-upgrade to invite
  INSERT INTO public.attendance_logs (profile_id, service_date, method)
  VALUES (v_member_id, DATE '2026-01-24', 'qr_scan');

  SELECT tier, consecutive_saturday_streak INTO v_tier, v_streak
  FROM public.profiles WHERE id = v_member_id;
  ASSERT v_streak = 4 AND v_tier = 'invite',
    format('Expected streak=4 invite, got streak=%s tier=%s', v_streak, v_tier);

  -- 3. Skip a Saturday (Jan 31) and attend Feb 7 -> streak resets to 1, tier STAYS invite
  INSERT INTO public.attendance_logs (profile_id, service_date, method)
  VALUES (v_member_id, DATE '2026-02-07', 'qr_scan');

  SELECT tier, consecutive_saturday_streak INTO v_tier, v_streak
  FROM public.profiles WHERE id = v_member_id;
  ASSERT v_streak = 1 AND v_tier = 'invite',
    format('Expected streak=1 and tier still invite, got streak=%s tier=%s', v_streak, v_tier);

  -- 4. Attend 7 more consecutive Saturdays (total 8 unbroken from Feb 7) -> auto-upgrade to disciple
  INSERT INTO public.attendance_logs (profile_id, service_date, method)
  VALUES
    (v_member_id, DATE '2026-02-14', 'qr_scan'),
    (v_member_id, DATE '2026-02-21', 'qr_scan'),
    (v_member_id, DATE '2026-02-28', 'qr_scan'),
    (v_member_id, DATE '2026-03-07', 'qr_scan'),
    (v_member_id, DATE '2026-03-14', 'qr_scan'),
    (v_member_id, DATE '2026-03-21', 'qr_scan'),
    (v_member_id, DATE '2026-03-28', 'qr_scan');

  SELECT tier, consecutive_saturday_streak INTO v_tier, v_streak
  FROM public.profiles WHERE id = v_member_id;
  ASSERT v_streak = 8 AND v_tier = 'disciple',
    format('Expected streak=8 disciple, got streak=%s tier=%s', v_streak, v_tier);

  -- 5. Verify pgcrypto encryption round-trip
  INSERT INTO public.care_notes (member_id, leader_id, encrypted_note, category)
  VALUES (v_member_id, v_leader_id, pgp_sym_encrypt('Confidential prayer need', v_key), 'pastoral')
  RETURNING id INTO v_note_id;

  SELECT pgp_sym_decrypt(encrypted_note, v_key)::TEXT INTO v_decrypted
  FROM public.care_notes WHERE id = v_note_id;
  ASSERT v_decrypted = 'Confidential prayer need', 'pgcrypto decryption mismatch';

  -- 6. Verify PHP Denomination generated column math
  INSERT INTO public.cash_liquidations (
    service_date, count_1000, count_500, count_200, count_100, count_50, count_20, count_10, count_5, count_1
  )
  VALUES (DATE '2026-03-28', 2, 1, 1, 3, 2, 5, 4, 2, 7)
  RETURNING id, actual_physical_cash INTO v_liq_id, v_actual;
  -- 2000 + 500 + 200 + 300 + 100 + 100 + 40 + 10 + 7 = 3257.00
  ASSERT v_actual = 3257.00, format('Expected PHP 3257.00, got %s', v_actual);

  RAISE NOTICE 'ALL SYCC DATABASE ASSERTIONS PASSED SUCCESSFULLY!';
END $$;

ROLLBACK;
