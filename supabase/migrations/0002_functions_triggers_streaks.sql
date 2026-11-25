-- ============================================================================
-- SYCC Youth Growth & Discipleship Monitoring System
-- Migration 0002: Security Helpers, Automated Streak Engine, Recursive
-- Hierarchy, pgcrypto Care Vault RPCs, Leader Graduation & 2-Counter PIN Lock
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Timestamp Touch Helper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_care_notes_updated_at ON public.care_notes;
CREATE TRIGGER trg_care_notes_updated_at
  BEFORE UPDATE ON public.care_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_cell_meetups_updated_at ON public.cell_meetups;
CREATE TRIGGER trg_cell_meetups_updated_at
  BEFORE UPDATE ON public.cell_meetups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_cash_liquidations_updated_at ON public.cash_liquidations;
CREATE TRIGGER trg_cash_liquidations_updated_at
  BEFORE UPDATE ON public.cash_liquidations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_koinonia_prayers_updated_at ON public.koinonia_prayers;
CREATE TRIGGER trg_koinonia_prayers_updated_at
  BEFORE UPDATE ON public.koinonia_prayers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_church_events_updated_at ON public.church_events;
CREATE TRIGGER trg_church_events_updated_at
  BEFORE UPDATE ON public.church_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 2. RBAC Security Helpers (SECURITY DEFINER with locked search_path)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(public.current_app_role() = 'system_admin'::public.app_role, FALSE);
$$;

CREATE OR REPLACE FUNCTION public.get_profile_role(p_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT role FROM public.profiles WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_tier(p_id UUID)
RETURNS public.discipleship_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT tier FROM public.profiles WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.list_eligible_counters()
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  role public.app_role,
  has_pin BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    p.id AS profile_id,
    p.full_name,
    p.role,
    (tp.profile_id IS NOT NULL) AS has_pin
  FROM public.profiles p
  LEFT JOIN public.treasurer_pins tp ON tp.profile_id = p.id
  WHERE p.is_active = TRUE
    AND p.role IN ('treasurer', 'pastor', 'system_admin')
    AND public.current_app_role() IN ('treasurer', 'pastor', 'system_admin')
  ORDER BY p.full_name ASC;
$$;

-- Helper: Is target profile inside the current Cell Leader's recursive umbrella?
CREATE OR REPLACE FUNCTION public.is_in_my_umbrella(p_target_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH RECURSIVE umbrella AS (
    SELECT p.id, ARRAY[p.id] AS path
    FROM public.profiles p
    WHERE p.current_leader_id = public.current_profile_id()
    UNION ALL
    SELECT child.id, u.path || child.id
    FROM public.profiles child
    JOIN umbrella u ON child.current_leader_id = u.id
    WHERE NOT (child.id = ANY(u.path))
  )
  SELECT EXISTS (SELECT 1 FROM umbrella WHERE id = p_target_profile_id);
$$;

-- Helper: Is target profile in the current member's invite lineage (downline or inviter)?
CREATE OR REPLACE FUNCTION public.is_in_my_invite_tree(p_target_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH RECURSIVE downline AS (
    SELECT p.id, ARRAY[p.id] AS path
    FROM public.profiles p
    WHERE p.id = public.current_profile_id()
    UNION ALL
    SELECT child.id, d.path || child.id
    FROM public.profiles child
    JOIN downline d ON child.invited_by_id = d.id
    WHERE NOT (child.id = ANY(d.path))
  )
  SELECT EXISTS (SELECT 1 FROM downline WHERE id = p_target_profile_id)
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = public.current_profile_id()
          AND (me.invited_by_id = p_target_profile_id OR me.current_leader_id = p_target_profile_id)
      );
$$;

-- ----------------------------------------------------------------------------
-- 3. Auto-Provision / Claim Profile on Supabase Auth Signup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_existing_profile_id UUID;
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    split_part(COALESCE(NEW.email, 'SYCC Youth'), '@', 1)
  );

  -- Claim an existing unclaimed walk-in profile if email matches
  IF NEW.email IS NOT NULL THEN
    SELECT id INTO v_existing_profile_id
    FROM public.profiles
    WHERE lower(email) = lower(NEW.email)
      AND auth_user_id IS NULL
    LIMIT 1;
  END IF;

  IF v_existing_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET auth_user_id = NEW.id,
        full_name = COALESCE(NULLIF(trim(full_name), ''), v_full_name)
    WHERE id = v_existing_profile_id;
  ELSE
    INSERT INTO public.profiles (id, auth_user_id, full_name, email, role, tier)
    VALUES (NEW.id, NEW.id, v_full_name, NEW.email, 'member', 'new_invite')
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 4. Guard Permanent Spiritual Genealogy (invited_by_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_permanent_invited_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Once set, invited_by_id can only be modified by system_admin
  IF OLD.invited_by_id IS NOT NULL
     AND NEW.invited_by_id IS DISTINCT FROM OLD.invited_by_id
     AND NOT public.is_system_admin()
     AND current_setting('app.allow_admin_override', TRUE) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'invited_by_id is permanent spiritual genealogy and cannot be overwritten except by system_admin.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_invited_by ON public.profiles;
CREATE TRIGGER trg_guard_invited_by
  BEFORE UPDATE OF invited_by_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_permanent_invited_by();

-- ----------------------------------------------------------------------------
-- 5. Automated Consecutive Saturday Streak Progression Engine
--    Rules:
--    - < 4 consecutive Saturdays: new_invite
--    - 4 consecutive Saturdays (1 month unbroken): new_invite -> invite
--      (never downgrades invite back to new_invite if streak later breaks)
--    - 8 consecutive Saturdays (2 months unbroken): -> disciple
--    - cell_leader & alumni: immune to automated streak tier changes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_attendance_streak(p_profile_id UUID)
RETURNS TABLE (
  new_streak INTEGER,
  new_longest INTEGER,
  total_attended INTEGER,
  previous_tier public.discipleship_tier,
  new_tier public.discipleship_tier
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_dates DATE[];
  v_total INTEGER := 0;
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_run INTEGER := 0;
  v_idx INTEGER;
  v_prev_tier public.discipleship_tier;
  v_next_tier public.discipleship_tier;
  v_last_date DATE;
BEGIN
  SELECT p.tier
  INTO v_prev_tier
  FROM public.profiles p
  WHERE p.id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT ARRAY_AGG(service_date ORDER BY service_date DESC)
  INTO v_dates
  FROM public.attendance_logs
  WHERE profile_id = p_profile_id;

  v_total := COALESCE(array_length(v_dates, 1), 0);

  IF v_total > 0 THEN
    v_last_date := v_dates[1];

    -- Current consecutive streak ending at the latest attended Saturday (7-day intervals)
    v_current_streak := 1;
    FOR v_idx IN 2..v_total LOOP
      IF (v_dates[v_idx - 1] - v_dates[v_idx]) = 7 THEN
        v_current_streak := v_current_streak + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;

    -- Longest historical consecutive Saturday streak
    v_run := 1;
    v_longest_streak := 1;
    FOR v_idx IN 2..v_total LOOP
      IF (v_dates[v_idx - 1] - v_dates[v_idx]) = 7 THEN
        v_run := v_run + 1;
        IF v_run > v_longest_streak THEN
          v_longest_streak := v_run;
        END IF;
      ELSE
        v_run := 1;
      END IF;
    END LOOP;
  ELSE
    v_last_date := NULL;
    v_current_streak := 0;
    v_longest_streak := 0;
  END IF;

  -- Tier progression rules (cell_leader & alumni are immune)
  v_next_tier := v_prev_tier;
  IF v_prev_tier NOT IN ('cell_leader'::public.discipleship_tier, 'alumni'::public.discipleship_tier) THEN
    IF v_current_streak >= 8 THEN
      v_next_tier := 'disciple'::public.discipleship_tier;
    ELSIF v_current_streak >= 4 AND v_prev_tier = 'new_invite'::public.discipleship_tier THEN
      v_next_tier := 'invite'::public.discipleship_tier;
    END IF;
    -- Never downgrade invite -> new_invite or disciple -> invite automatically
  END IF;

  UPDATE public.profiles
  SET consecutive_saturday_streak = v_current_streak,
      longest_saturday_streak = GREATEST(longest_saturday_streak, v_longest_streak),
      total_saturdays_attended = v_total,
      last_attended_saturday = v_last_date,
      tier = v_next_tier
  WHERE id = p_profile_id;

  RETURN QUERY SELECT v_current_streak, GREATEST(v_longest_streak, 0), v_total, v_prev_tier, v_next_tier;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_attendance_logs_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_attendance_streak(OLD.profile_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_attendance_streak(NEW.profile_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_recalc ON public.attendance_logs;
CREATE TRIGGER trg_attendance_recalc
  AFTER INSERT OR DELETE ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_attendance_logs_streak();

-- ----------------------------------------------------------------------------
-- 6. Recursive Dual-Hierarchy RPCs (WITH RECURSIVE + Cycle Guards)
-- ----------------------------------------------------------------------------

-- 6A. Umbrella Cell Counts (rolls emerging cell leaders into mentor umbrella)
CREATE OR REPLACE FUNCTION public.get_umbrella_cell_counts(p_leader_id UUID DEFAULT NULL)
RETURNS TABLE (
  leader_id UUID,
  leader_name TEXT,
  is_top_level BOOLEAN,
  direct_count BIGINT,
  umbrella_total BIGINT,
  emerging_leaders_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH RECURSIVE tree AS (
    SELECT
      p.id AS root_leader_id,
      child.id AS member_id,
      child.tier AS member_tier,
      1 AS depth,
      ARRAY[p.id, child.id] AS path
    FROM public.profiles p
    JOIN public.profiles child ON child.current_leader_id = p.id
    WHERE p.tier = 'cell_leader'
      AND p.is_active = TRUE
      AND child.is_active = TRUE
      AND (p_leader_id IS NULL OR p.id = p_leader_id)

    UNION ALL

    SELECT
      t.root_leader_id,
      c.id AS member_id,
      c.tier AS member_tier,
      t.depth + 1,
      t.path || c.id
    FROM tree t
    JOIN public.profiles c ON c.current_leader_id = t.member_id
    WHERE c.is_active = TRUE
      AND NOT (c.id = ANY(t.path))
  )
  SELECT
    l.id AS leader_id,
    l.full_name AS leader_name,
    (l.current_leader_id IS NULL) AS is_top_level,
    COALESCE(COUNT(DISTINCT t.member_id) FILTER (WHERE t.depth = 1), 0) AS direct_count,
    COALESCE(COUNT(DISTINCT t.member_id), 0) AS umbrella_total,
    COALESCE(COUNT(DISTINCT t.member_id) FILTER (WHERE t.member_tier = 'cell_leader'), 0) AS emerging_leaders_count
  FROM public.profiles l
  LEFT JOIN tree t ON t.root_leader_id = l.id
  WHERE l.tier = 'cell_leader'
    AND l.is_active = TRUE
    AND (p_leader_id IS NULL OR l.id = p_leader_id)
  GROUP BY l.id, l.full_name, l.current_leader_id
  ORDER BY (l.current_leader_id IS NULL) DESC, l.full_name ASC;
$$;

-- 6B. Permanent Spiritual Genealogy Tree (over invited_by_id)
CREATE OR REPLACE FUNCTION public.get_discipleship_tree(p_root_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  nickname TEXT,
  avatar_url TEXT,
  tier public.discipleship_tier,
  role public.app_role,
  invited_by_id UUID,
  current_leader_id UUID,
  consecutive_saturday_streak INTEGER,
  ministry_team TEXT,
  depth INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH RECURSIVE genealogy AS (
    SELECT
      p.id,
      p.full_name,
      p.nickname,
      p.avatar_url,
      p.tier,
      p.role,
      p.invited_by_id,
      p.current_leader_id,
      p.consecutive_saturday_streak,
      p.ministry_team,
      0 AS depth,
      ARRAY[p.id] AS path
    FROM public.profiles p
    WHERE p.is_active = TRUE
      AND (
        (p_root_id IS NOT NULL AND p.id = p_root_id)
        OR (p_root_id IS NULL AND p.invited_by_id IS NULL)
      )

    UNION ALL

    SELECT
      c.id,
      c.full_name,
      c.nickname,
      c.avatar_url,
      c.tier,
      c.role,
      c.invited_by_id,
      c.current_leader_id,
      c.consecutive_saturday_streak,
      c.ministry_team,
      g.depth + 1,
      g.path || c.id
    FROM public.profiles c
    JOIN genealogy g ON c.invited_by_id = g.id
    WHERE c.is_active = TRUE
      AND NOT (c.id = ANY(g.path))
  )
  SELECT
    g.id,
    g.full_name,
    g.nickname,
    g.avatar_url,
    g.tier,
    g.role,
    g.invited_by_id,
    g.current_leader_id,
    g.consecutive_saturday_streak,
    g.ministry_team,
    g.depth
  FROM genealogy g
  ORDER BY g.depth ASC, g.full_name ASC;
$$;

-- 6C. Retention Radar for Cell Leaders (missed >= 2 Saturdays or 1 week from milestone)
CREATE OR REPLACE FUNCTION public.get_retention_radar(
  p_leader_id UUID,
  p_reference_saturday DATE
)
RETURNS TABLE (
  member_id UUID,
  full_name TEXT,
  tier public.discipleship_tier,
  current_leader_id UUID,
  consecutive_saturday_streak INTEGER,
  last_attended_saturday DATE,
  weeks_missed INTEGER,
  alert_type TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    p.id AS member_id,
    p.full_name,
    p.tier,
    p.current_leader_id,
    p.consecutive_saturday_streak,
    p.last_attended_saturday,
    CASE
      WHEN p.last_attended_saturday IS NULL THEN 99
      ELSE GREATEST(0, ((p_reference_saturday - p.last_attended_saturday) / 7))
    END AS weeks_missed,
    CASE
      WHEN p.last_attended_saturday IS NULL OR (p_reference_saturday - p.last_attended_saturday) >= 14 THEN 'missed_2_plus_weeks'
      WHEN p.tier = 'new_invite' AND p.consecutive_saturday_streak = 3 THEN 'milestone_4wk_next'
      WHEN p.tier = 'invite' AND p.consecutive_saturday_streak = 7 THEN 'milestone_8wk_next'
      ELSE 'healthy'
    END AS alert_type
  FROM public.profiles p
  WHERE p.current_leader_id = p_leader_id
    AND p.is_active = TRUE
    AND (
      p.last_attended_saturday IS NULL
      OR (p_reference_saturday - p.last_attended_saturday) >= 14
      OR (p.tier = 'new_invite' AND p.consecutive_saturday_streak = 3)
      OR (p.tier = 'invite' AND p.consecutive_saturday_streak = 7)
    )
  ORDER BY weeks_missed DESC, p.full_name ASC;
$$;

-- ----------------------------------------------------------------------------
-- 7. Encrypted Care Vault RPCs (pgcrypto pgp_sym_encrypt / pgp_sym_decrypt)
--    Called ONLY from Server Actions passing server-only CARE_VAULT_ENCRYPTION_KEY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_care_note(
  p_member_id UUID,
  p_plaintext TEXT,
  p_category TEXT,
  p_follow_up_date DATE,
  p_encryption_key TEXT,
  p_note_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_id UUID := public.current_profile_id();
  v_actor_role public.app_role := public.current_app_role();
  v_member_leader UUID;
  v_note_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_actor_role NOT IN ('cell_leader'::public.app_role, 'system_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only Cell Leaders or System Admin can write to the Care Vault';
  END IF;

  IF p_encryption_key IS NULL OR char_length(p_encryption_key) < 16 THEN
    RAISE EXCEPTION 'Server encryption key is not configured';
  END IF;

  SELECT current_leader_id INTO v_member_leader
  FROM public.profiles
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_actor_role <> 'system_admin'::public.app_role
     AND v_member_leader IS DISTINCT FROM v_actor_id
     AND NOT public.is_in_my_umbrella(p_member_id) THEN
    RAISE EXCEPTION 'You can only write care notes for members in your cell';
  END IF;

  IF p_note_id IS NULL THEN
    INSERT INTO public.care_notes (
      member_id, leader_id, encrypted_note, category, follow_up_date
    )
    VALUES (
      p_member_id,
      v_actor_id,
      pgp_sym_encrypt(p_plaintext, p_encryption_key),
      COALESCE(NULLIF(p_category, ''), 'pastoral'),
      p_follow_up_date
    )
    RETURNING id INTO v_note_id;
  ELSE
    UPDATE public.care_notes
    SET encrypted_note = pgp_sym_encrypt(p_plaintext, p_encryption_key),
        category = COALESCE(NULLIF(p_category, ''), category),
        follow_up_date = p_follow_up_date
    WHERE id = p_note_id
      AND is_archived = FALSE
      AND (leader_id = v_actor_id OR v_actor_role = 'system_admin'::public.app_role)
    RETURNING id INTO v_note_id;

    IF v_note_id IS NULL THEN
      RAISE EXCEPTION 'Care note not found or not editable';
    END IF;
  END IF;

  RETURN v_note_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_care_notes(
  p_member_id UUID,
  p_encryption_key TEXT,
  p_include_archived BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  member_id UUID,
  leader_id UUID,
  plaintext_note TEXT,
  category TEXT,
  follow_up_date DATE,
  is_archived BOOLEAN,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_id UUID := public.current_profile_id();
  v_actor_role public.app_role := public.current_app_role();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_actor_role NOT IN ('cell_leader'::public.app_role, 'system_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Care Vault access denied';
  END IF;

  IF p_encryption_key IS NULL OR char_length(p_encryption_key) < 16 THEN
    RAISE EXCEPTION 'Server encryption key is not configured';
  END IF;

  RETURN QUERY
  SELECT
    cn.id,
    cn.member_id,
    cn.leader_id,
    pgp_sym_decrypt(cn.encrypted_note, p_encryption_key)::TEXT AS plaintext_note,
    cn.category,
    cn.follow_up_date,
    cn.is_archived,
    cn.archived_at,
    cn.created_at,
    cn.updated_at
  FROM public.care_notes cn
  WHERE cn.member_id = p_member_id
    AND (
      (v_actor_role = 'system_admin'::public.app_role AND (p_include_archived OR cn.is_archived = FALSE))
      OR (cn.leader_id = v_actor_id AND cn.is_archived = FALSE)
    )
  ORDER BY cn.created_at DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Leader Graduation RPC (Archives old Care Notes + Reassigns Cell + Audits)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.graduate_cell_leader(
  p_leader_id UUID,
  p_new_leader_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_id UUID := public.current_profile_id();
  v_before JSONB;
  v_reassigned_count INTEGER := 0;
  v_archived_notes_count INTEGER := 0;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Only system_admin can execute Leader Graduation';
  END IF;

  IF p_leader_id = p_new_leader_id THEN
    RAISE EXCEPTION 'Incoming leader must be different from graduating leader';
  END IF;

  SELECT to_jsonb(p.*) INTO v_before
  FROM public.profiles p
  WHERE p.id = p_leader_id
  FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Graduating leader profile not found';
  END IF;

  -- 1. Transition leader to alumni tier (role demotes to member unless admin)
  UPDATE public.profiles
  SET tier = 'alumni'::public.discipleship_tier,
      role = CASE WHEN role = 'cell_leader'::public.app_role THEN 'member'::public.app_role ELSE role END
  WHERE id = p_leader_id;

  -- 2. Reassign direct cell members' current_leader_id ONLY (never touch invited_by_id)
  UPDATE public.profiles
  SET current_leader_id = p_new_leader_id
  WHERE current_leader_id = p_leader_id;
  GET DIAGNOSTICS v_reassigned_count = ROW_COUNT;

  -- 3. Archive all old care_notes so incoming leader starts with a clean, private vault
  UPDATE public.care_notes
  SET is_archived = TRUE,
      archived_at = now()
  WHERE leader_id = p_leader_id
    AND is_archived = FALSE;
  GET DIAGNOSTICS v_archived_notes_count = ROW_COUNT;

  -- 4. Append mandatory audit record
  INSERT INTO public.system_audit_logs (
    actor_id, action, target_table, target_id, before_state, after_state, reason
  )
  VALUES (
    v_actor_id,
    'leader_graduation',
    'profiles',
    p_leader_id,
    v_before,
    jsonb_build_object(
      'new_tier', 'alumni',
      'incoming_leader_id', p_new_leader_id,
      'reassigned_members_count', v_reassigned_count,
      'archived_care_notes_count', v_archived_notes_count
    ),
    p_reason
  );

  RETURN jsonb_build_object(
    'reassigned_members', v_reassigned_count,
    'archived_care_notes', v_archived_notes_count
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Treasury Liquidation Totals, Lock Guards & 2-Counter PIN Sign-Off
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_cash_liquidation(p_liquidation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_service_date DATE;
  v_expected_cash NUMERIC(12,2);
  v_gcash_total NUMERIC(12,2);
  v_expenses NUMERIC(12,2);
  v_actual_cash NUMERIC(12,2);
BEGIN
  SELECT service_date, actual_physical_cash
  INTO v_service_date, v_actual_cash
  FROM public.cash_liquidations
  WHERE id = p_liquidation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash'), 0.00),
    COALESCE(SUM(amount) FILTER (WHERE payment_method = 'gcash_ewallet'), 0.00)
  INTO v_expected_cash, v_gcash_total
  FROM public.tithes_and_offerings
  WHERE service_date = v_service_date;

  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_expenses
  FROM public.liquidation_expenses
  WHERE liquidation_id = p_liquidation_id;

  UPDATE public.cash_liquidations
  SET expected_cash_total = v_expected_cash,
      gcash_ewallet_total = v_gcash_total,
      total_expenses = v_expenses,
      net_turnover = v_actual_cash - v_expenses,
      variance = v_actual_cash - v_expected_cash
  WHERE id = p_liquidation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_locked_liquidation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  IF current_setting('app.allow_admin_override', TRUE) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'cash_liquidations' THEN
    IF OLD.is_locked = TRUE THEN
      -- Allow only setting receipts_dispatched_at once locked
      IF TG_OP = 'UPDATE'
         AND NEW.is_locked = TRUE
         AND NEW.count_1000 = OLD.count_1000
         AND NEW.count_500 = OLD.count_500
         AND NEW.count_200 = OLD.count_200
         AND NEW.count_100 = OLD.count_100
         AND NEW.count_50 = OLD.count_50
         AND NEW.count_20 = OLD.count_20
         AND NEW.count_10 = OLD.count_10
         AND NEW.count_5 = OLD.count_5
         AND NEW.count_1 = OLD.count_1
         AND NEW.expected_cash_total = OLD.expected_cash_total
         AND NEW.total_expenses = OLD.total_expenses
         AND NEW.net_turnover = OLD.net_turnover THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Cash liquidation sheet is locked by 2-Counter PIN sign-off. Only system_admin override may unlock it.';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'liquidation_expenses' THEN
    SELECT is_locked INTO v_locked
    FROM public.cash_liquidations
    WHERE id = COALESCE(NEW.liquidation_id, OLD.liquidation_id);
    IF COALESCE(v_locked, FALSE) THEN
      RAISE EXCEPTION 'Cannot modify expenses on a locked liquidation sheet.';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'tithes_and_offerings' THEN
    -- Allow stamping receipt_sent_at after lock
    IF TG_OP = 'UPDATE'
       AND NEW.amount = OLD.amount
       AND NEW.giving_type = OLD.giving_type
       AND NEW.payment_method = OLD.payment_method
       AND NEW.giver_id IS NOT DISTINCT FROM OLD.giver_id
       AND NEW.service_date = OLD.service_date THEN
      RETURN NEW;
    END IF;

    SELECT is_locked INTO v_locked
    FROM public.cash_liquidations
    WHERE service_date = COALESCE(NEW.service_date, OLD.service_date);
    IF COALESCE(v_locked, FALSE) THEN
      RAISE EXCEPTION 'Cannot modify tithes/offerings for a locked Saturday liquidation sheet.';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_locked_cash_liquidations ON public.cash_liquidations;
CREATE TRIGGER trg_guard_locked_cash_liquidations
  BEFORE UPDATE OR DELETE ON public.cash_liquidations
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_liquidation();

DROP TRIGGER IF EXISTS trg_guard_locked_liquidation_expenses ON public.liquidation_expenses;
CREATE TRIGGER trg_guard_locked_liquidation_expenses
  BEFORE INSERT OR UPDATE OR DELETE ON public.liquidation_expenses
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_liquidation();

DROP TRIGGER IF EXISTS trg_guard_locked_tithes ON public.tithes_and_offerings;
CREATE TRIGGER trg_guard_locked_tithes
  BEFORE INSERT OR UPDATE OR DELETE ON public.tithes_and_offerings
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_liquidation();

-- Set or update a user's Treasury PIN (4-8 digits, bcrypt hashed via pgcrypto)
CREATE OR REPLACE FUNCTION public.set_treasurer_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_id UUID := public.current_profile_id();
  v_role public.app_role := public.current_app_role();
BEGIN
  IF v_actor_id IS NULL OR v_role NOT IN ('treasurer'::public.app_role, 'pastor'::public.app_role, 'system_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized to set a Treasury PIN';
  END IF;

  IF p_pin !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'Treasury PIN must be 4 to 8 numeric digits';
  END IF;

  INSERT INTO public.treasurer_pins (profile_id, pin_hash, updated_at)
  VALUES (v_actor_id, crypt(p_pin, gen_salt('bf')), now())
  ON CONFLICT (profile_id)
  DO UPDATE SET pin_hash = EXCLUDED.pin_hash, updated_at = now();

  RETURN TRUE;
END;
$$;

-- 2-Counter PIN Sign-Off & Lock RPC
CREATE OR REPLACE FUNCTION public.sign_and_lock_liquidation(
  p_liquidation_id UUID,
  p_counter_1_id UUID,
  p_counter_1_pin TEXT,
  p_counter_2_id UUID,
  p_counter_2_pin TEXT
)
RETURNS public.cash_liquidations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role public.app_role := public.current_app_role();
  v_hash_1 TEXT;
  v_hash_2 TEXT;
  v_role_1 public.app_role;
  v_role_2 public.app_role;
  v_result public.cash_liquidations;
BEGIN
  IF v_role NOT IN ('treasurer'::public.app_role, 'system_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only Treasurer or System Admin can lock a liquidation sheet';
  END IF;

  IF p_counter_1_id IS NULL OR p_counter_2_id IS NULL OR p_counter_1_id = p_counter_2_id THEN
    RAISE EXCEPTION 'Two distinct counters are required for 2-Counter PIN sign-off';
  END IF;

  SELECT tp.pin_hash, p.role INTO v_hash_1, v_role_1
  FROM public.treasurer_pins tp
  JOIN public.profiles p ON p.id = tp.profile_id
  WHERE tp.profile_id = p_counter_1_id;

  SELECT tp.pin_hash, p.role INTO v_hash_2, v_role_2
  FROM public.treasurer_pins tp
  JOIN public.profiles p ON p.id = tp.profile_id
  WHERE tp.profile_id = p_counter_2_id;

  IF v_hash_1 IS NULL OR v_role_1 NOT IN ('treasurer', 'pastor', 'system_admin') THEN
    RAISE EXCEPTION 'Counter 1 does not have an eligible registered Treasury PIN';
  END IF;

  IF v_hash_2 IS NULL OR v_role_2 NOT IN ('treasurer', 'pastor', 'system_admin') THEN
    RAISE EXCEPTION 'Counter 2 does not have an eligible registered Treasury PIN';
  END IF;

  IF crypt(p_counter_1_pin, v_hash_1) <> v_hash_1 THEN
    RAISE EXCEPTION 'Invalid PIN for Counter 1';
  END IF;

  IF crypt(p_counter_2_pin, v_hash_2) <> v_hash_2 THEN
    RAISE EXCEPTION 'Invalid PIN for Counter 2';
  END IF;

  -- Refresh exact totals before locking
  PERFORM public.recompute_cash_liquidation(p_liquidation_id);

  UPDATE public.cash_liquidations
  SET counter_1_id = p_counter_1_id,
      counter_1_signed_at = now(),
      counter_2_id = p_counter_2_id,
      counter_2_signed_at = now(),
      is_locked = TRUE,
      locked_at = now()
  WHERE id = p_liquidation_id
    AND is_locked = FALSE
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Liquidation sheet not found or already locked';
  END IF;

  -- Link all tithes for that service_date to this liquidation sheet
  PERFORM set_config('app.allow_admin_override', 'on', TRUE);
  UPDATE public.tithes_and_offerings
  SET liquidation_id = v_result.id
  WHERE service_date = v_result.service_date
    AND liquidation_id IS NULL;

  RETURN v_result;
END;
$$;

-- System Admin Override: Unlock Cash Liquidation (mandatory audit log)
CREATE OR REPLACE FUNCTION public.admin_unlock_liquidation(
  p_liquidation_id UUID,
  p_reason TEXT
)
RETURNS public.cash_liquidations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_id UUID := public.current_profile_id();
  v_before JSONB;
  v_after public.cash_liquidations;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Only system_admin can unlock a locked cash liquidation';
  END IF;

  IF char_length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'A clear audit reason is required to unlock a liquidation sheet';
  END IF;

  SELECT to_jsonb(cl.*) INTO v_before
  FROM public.cash_liquidations cl
  WHERE cl.id = p_liquidation_id;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Cash liquidation sheet not found';
  END IF;

  PERFORM set_config('app.allow_admin_override', 'on', TRUE);

  UPDATE public.cash_liquidations
  SET is_locked = FALSE,
      locked_at = NULL,
      counter_1_id = NULL,
      counter_1_signed_at = NULL,
      counter_2_id = NULL,
      counter_2_signed_at = NULL
  WHERE id = p_liquidation_id
  RETURNING * INTO v_after;

  INSERT INTO public.system_audit_logs (
    actor_id, action, target_table, target_id, before_state, after_state, reason
  )
  VALUES (
    v_actor_id,
    'unlock_cash_liquidation',
    'cash_liquidations',
    p_liquidation_id,
    v_before,
    to_jsonb(v_after),
    p_reason
  );

  RETURN v_after;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Pastor Masked Financial Summary RPC (Aggregates ONLY, never individual tithes)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pastor_financial_summary(p_limit INTEGER DEFAULT 12)
RETURNS TABLE (
  service_date DATE,
  total_tithes NUMERIC(12,2),
  total_offerings NUMERIC(12,2),
  total_missions NUMERIC(12,2),
  total_special NUMERIC(12,2),
  gross_cash NUMERIC(12,2),
  gcash_total NUMERIC(12,2),
  total_expenses NUMERIC(12,2),
  net_turnover NUMERIC(12,2),
  is_locked BOOLEAN,
  giver_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role public.app_role := public.current_app_role();
BEGIN
  IF v_role NOT IN ('pastor'::public.app_role, 'treasurer'::public.app_role, 'system_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Financial summary access denied';
  END IF;

  RETURN QUERY
  SELECT
    d.service_date,
    COALESCE(SUM(t.amount) FILTER (WHERE t.giving_type = 'tithe'), 0.00) AS total_tithes,
    COALESCE(SUM(t.amount) FILTER (WHERE t.giving_type = 'offering'), 0.00) AS total_offerings,
    COALESCE(SUM(t.amount) FILTER (WHERE t.giving_type = 'missions'), 0.00) AS total_missions,
    COALESCE(SUM(t.amount) FILTER (WHERE t.giving_type = 'special'), 0.00) AS total_special,
    COALESCE(MAX(cl.actual_physical_cash), COALESCE(SUM(t.amount) FILTER (WHERE t.payment_method = 'cash'), 0.00)) AS gross_cash,
    COALESCE(SUM(t.amount) FILTER (WHERE t.payment_method = 'gcash_ewallet'), 0.00) AS gcash_total,
    COALESCE(MAX(cl.total_expenses), 0.00) AS total_expenses,
    COALESCE(MAX(cl.net_turnover), COALESCE(SUM(t.amount) FILTER (WHERE t.payment_method = 'cash'), 0.00)) AS net_turnover,
    COALESCE(BOOL_OR(cl.is_locked), FALSE) AS is_locked,
    COUNT(DISTINCT t.giver_id) AS giver_count
  FROM (
    SELECT service_date FROM public.tithes_and_offerings
    UNION
    SELECT service_date FROM public.cash_liquidations
  ) d
  LEFT JOIN public.tithes_and_offerings t ON t.service_date = d.service_date
  LEFT JOIN public.cash_liquidations cl ON cl.service_date = d.service_date
  GROUP BY d.service_date
  ORDER BY d.service_date DESC
  LIMIT GREATEST(1, LEAST(p_limit, 52));
END;
$$;
