-- ============================================================================
-- SYCC Youth Growth & Discipleship Monitoring System
-- Migration 0003: Strict Row-Level Security (RLS), Realtime, Storage & Seed
-- ============================================================================

-- Enable RLS on ALL application tables
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cell_meetups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cell_meetup_rsvps    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tithes_and_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_liquidations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidation_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasurer_pins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.koinonia_prayers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_amens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_theme_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs    ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. PROFILES RLS
-- ============================================================================
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.is_system_admin()
    OR id = public.current_profile_id()
    OR public.current_app_role() IN ('registrar', 'treasurer', 'pastor')
    OR (public.current_app_role() = 'cell_leader' AND public.is_in_my_umbrella(id))
    OR public.is_in_my_invite_tree(id)
    -- Allow viewing active cell leaders so members know their shepherd name
    OR tier = 'cell_leader'
  );

DROP POLICY IF EXISTS profiles_insert_walkin_or_admin ON public.profiles;
CREATE POLICY profiles_insert_walkin_or_admin ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_system_admin()
    OR (
      public.current_app_role() = 'registrar'
      AND auth_user_id IS NULL
      AND role = 'member'
      AND tier = 'new_invite'
    )
  );

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_system_admin()
    OR id = public.current_profile_id()
    OR (public.current_app_role() = 'cell_leader' AND current_leader_id = public.current_profile_id())
  )
  WITH CHECK (
    public.is_system_admin()
    OR (
      -- Self-updates cannot escalate role or tier
      id = public.current_profile_id()
      AND role = public.get_profile_role(public.current_profile_id())
      AND tier = public.get_profile_tier(public.current_profile_id())
    )
    OR (
      -- Cell Leader can update ministry status/team of their own direct cell members, never role/tier
      public.current_app_role() = 'cell_leader'
      AND current_leader_id = public.current_profile_id()
      AND role = public.get_profile_role(id)
      AND tier = public.get_profile_tier(id)
    )
  );

DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
CREATE POLICY profiles_delete_admin ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_system_admin());

-- ============================================================================
-- 2. ATTENDANCE LOGS RLS
-- ============================================================================
DROP POLICY IF EXISTS attendance_select ON public.attendance_logs;
CREATE POLICY attendance_select ON public.attendance_logs
  FOR SELECT TO authenticated
  USING (
    public.is_system_admin()
    OR profile_id = public.current_profile_id()
    OR public.current_app_role() IN ('registrar', 'treasurer', 'pastor')
    OR (public.current_app_role() = 'cell_leader' AND public.is_in_my_umbrella(profile_id))
  );

DROP POLICY IF EXISTS attendance_insert_registrar_admin ON public.attendance_logs;
CREATE POLICY attendance_insert_registrar_admin ON public.attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_system_admin()
    OR public.current_app_role() = 'registrar'
  );

DROP POLICY IF EXISTS attendance_delete_registrar_admin ON public.attendance_logs;
CREATE POLICY attendance_delete_registrar_admin ON public.attendance_logs
  FOR DELETE TO authenticated
  USING (
    public.is_system_admin()
    OR public.current_app_role() = 'registrar'
  );

-- ============================================================================
-- 3. CARE NOTES (ENCRYPTED CARE VAULT) RLS
--    Registrar, Treasurer, Pastor, Member have ZERO access.
--    Cell Leaders see ONLY their own unarchived notes.
-- ============================================================================
DROP POLICY IF EXISTS care_notes_select ON public.care_notes;
CREATE POLICY care_notes_select ON public.care_notes
  FOR SELECT TO authenticated
  USING (
    public.is_system_admin()
    OR (
      public.current_app_role() = 'cell_leader'
      AND leader_id = public.current_profile_id()
      AND is_archived = FALSE
    )
  );

DROP POLICY IF EXISTS care_notes_insert ON public.care_notes;
CREATE POLICY care_notes_insert ON public.care_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_system_admin()
    OR (
      public.current_app_role() = 'cell_leader'
      AND leader_id = public.current_profile_id()
      AND public.is_in_my_umbrella(member_id)
    )
  );

DROP POLICY IF EXISTS care_notes_update ON public.care_notes;
CREATE POLICY care_notes_update ON public.care_notes
  FOR UPDATE TO authenticated
  USING (
    public.is_system_admin()
    OR (
      public.current_app_role() = 'cell_leader'
      AND leader_id = public.current_profile_id()
      AND is_archived = FALSE
    )
  );

DROP POLICY IF EXISTS care_notes_delete ON public.care_notes;
CREATE POLICY care_notes_delete ON public.care_notes
  FOR DELETE TO authenticated
  USING (
    public.is_system_admin()
    OR (
      public.current_app_role() = 'cell_leader'
      AND leader_id = public.current_profile_id()
      AND is_archived = FALSE
    )
  );

-- ============================================================================
-- 4. CELL MEETUPS & RSVPS RLS
-- ============================================================================
DROP POLICY IF EXISTS cell_meetups_select ON public.cell_meetups;
CREATE POLICY cell_meetups_select ON public.cell_meetups
  FOR SELECT TO authenticated
  USING (
    public.is_system_admin()
    OR public.current_app_role() = 'pastor'
    OR leader_id = public.current_profile_id()
    OR leader_id = (SELECT current_leader_id FROM public.profiles WHERE id = public.current_profile_id())
  );

DROP POLICY IF EXISTS cell_meetups_manage ON public.cell_meetups;
CREATE POLICY cell_meetups_manage ON public.cell_meetups
  FOR ALL TO authenticated
  USING (
    public.is_system_admin()
    OR (public.current_app_role() = 'cell_leader' AND leader_id = public.current_profile_id())
  )
  WITH CHECK (
    public.is_system_admin()
    OR (public.current_app_role() = 'cell_leader' AND leader_id = public.current_profile_id())
  );

DROP POLICY IF EXISTS cell_meetup_rsvps_select ON public.cell_meetup_rsvps;
CREATE POLICY cell_meetup_rsvps_select ON public.cell_meetup_rsvps
  FOR SELECT TO authenticated
  USING (
    public.is_system_admin()
    OR member_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.cell_meetups cm
      WHERE cm.id = meetup_id AND cm.leader_id = public.current_profile_id()
    )
  );

DROP POLICY IF EXISTS cell_meetup_rsvps_upsert ON public.cell_meetup_rsvps;
CREATE POLICY cell_meetup_rsvps_upsert ON public.cell_meetup_rsvps
  FOR ALL TO authenticated
  USING (public.is_system_admin() OR member_id = public.current_profile_id())
  WITH CHECK (public.is_system_admin() OR member_id = public.current_profile_id());

-- ============================================================================
-- 5. TREASURY RLS (TITHES, CASH LIQUIDATIONS, EXPENSES, PINS)
--    Individual tithes are strictly masked from Pastor, Registrar, Cell Leaders.
--    Members/Cell Leaders can ONLY view their own personal giving history.
-- ============================================================================
DROP POLICY IF EXISTS tithes_select ON public.tithes_and_offerings;
CREATE POLICY tithes_select ON public.tithes_and_offerings
  FOR SELECT TO authenticated
  USING (
    public.is_system_admin()
    OR public.current_app_role() = 'treasurer'
    OR giver_id = public.current_profile_id()
  );

DROP POLICY IF EXISTS tithes_manage_treasurer ON public.tithes_and_offerings;
CREATE POLICY tithes_manage_treasurer ON public.tithes_and_offerings
  FOR ALL TO authenticated
  USING (
    public.is_system_admin()
    OR public.current_app_role() = 'treasurer'
  )
  WITH CHECK (
    public.is_system_admin()
    OR public.current_app_role() = 'treasurer'
  );

DROP POLICY IF EXISTS cash_liquidations_treasurer_admin ON public.cash_liquidations;
CREATE POLICY cash_liquidations_treasurer_admin ON public.cash_liquidations
  FOR ALL TO authenticated
  USING (
    public.is_system_admin()
    OR public.current_app_role() = 'treasurer'
  )
  WITH CHECK (
    public.is_system_admin()
    OR public.current_app_role() = 'treasurer'
  );

DROP POLICY IF EXISTS liquidation_expenses_treasurer_admin ON public.liquidation_expenses;
CREATE POLICY liquidation_expenses_treasurer_admin ON public.liquidation_expenses
  FOR ALL TO authenticated
  USING (
    public.is_system_admin()
    OR public.current_app_role() = 'treasurer'
  )
  WITH CHECK (
    public.is_system_admin()
    OR public.current_app_role() = 'treasurer'
  );

DROP POLICY IF EXISTS treasurer_pins_self_or_admin ON public.treasurer_pins;
CREATE POLICY treasurer_pins_self_or_admin ON public.treasurer_pins
  FOR SELECT TO authenticated
  USING (
    public.is_system_admin()
    OR profile_id = public.current_profile_id()
  );

-- ============================================================================
-- 6. KOINONIA PRAYER WALL & CHURCH EVENTS RLS
-- ============================================================================
DROP POLICY IF EXISTS prayers_select_all ON public.koinonia_prayers;
CREATE POLICY prayers_select_all ON public.koinonia_prayers
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS prayers_insert_self ON public.koinonia_prayers;
CREATE POLICY prayers_insert_self ON public.koinonia_prayers
  FOR INSERT TO authenticated
  WITH CHECK (author_id = public.current_profile_id() OR public.is_system_admin());

DROP POLICY IF EXISTS prayers_update_self_or_admin ON public.koinonia_prayers;
CREATE POLICY prayers_update_self_or_admin ON public.koinonia_prayers
  FOR UPDATE TO authenticated
  USING (author_id = public.current_profile_id() OR public.is_system_admin());

DROP POLICY IF EXISTS prayers_delete_self_or_admin ON public.koinonia_prayers;
CREATE POLICY prayers_delete_self_or_admin ON public.koinonia_prayers
  FOR DELETE TO authenticated
  USING (author_id = public.current_profile_id() OR public.is_system_admin());

DROP POLICY IF EXISTS prayer_amens_select_all ON public.prayer_amens;
CREATE POLICY prayer_amens_select_all ON public.prayer_amens
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS prayer_amens_manage_self ON public.prayer_amens;
CREATE POLICY prayer_amens_manage_self ON public.prayer_amens
  FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id() OR public.is_system_admin())
  WITH CHECK (profile_id = public.current_profile_id() OR public.is_system_admin());

DROP POLICY IF EXISTS church_events_select ON public.church_events;
CREATE POLICY church_events_select ON public.church_events
  FOR SELECT TO authenticated
  USING (
    is_published = TRUE
    OR public.is_system_admin()
    OR public.current_app_role() = 'pastor'
  );

DROP POLICY IF EXISTS church_events_manage ON public.church_events;
CREATE POLICY church_events_manage ON public.church_events
  FOR ALL TO authenticated
  USING (public.is_system_admin() OR public.current_app_role() = 'pastor')
  WITH CHECK (public.is_system_admin() OR public.current_app_role() = 'pastor');

DROP POLICY IF EXISTS event_rsvps_select ON public.event_rsvps;
CREATE POLICY event_rsvps_select ON public.event_rsvps
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS event_rsvps_manage_self ON public.event_rsvps;
CREATE POLICY event_rsvps_manage_self ON public.event_rsvps
  FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id() OR public.is_system_admin())
  WITH CHECK (profile_id = public.current_profile_id() OR public.is_system_admin());

-- ============================================================================
-- 7. PUSH SUBSCRIPTIONS, THEME STUDIO & SYSTEM AUDIT LOGS RLS
-- ============================================================================
DROP POLICY IF EXISTS push_subs_self_or_admin ON public.push_subscriptions;
CREATE POLICY push_subs_self_or_admin ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id() OR public.is_system_admin())
  WITH CHECK (profile_id = public.current_profile_id() OR public.is_system_admin());

DROP POLICY IF EXISTS theme_select_public ON public.app_theme_settings;
CREATE POLICY theme_select_public ON public.app_theme_settings
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS theme_manage_pastor_admin ON public.app_theme_settings;
CREATE POLICY theme_manage_pastor_admin ON public.app_theme_settings
  FOR ALL TO authenticated
  USING (public.is_system_admin() OR public.current_app_role() = 'pastor')
  WITH CHECK (public.is_system_admin() OR public.current_app_role() = 'pastor');

-- System Audit Logs: Append-only for system_admin & pastor theme changes; READ ONLY for system_admin
DROP POLICY IF EXISTS audit_logs_select_admin ON public.system_audit_logs;
CREATE POLICY audit_logs_select_admin ON public.system_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_system_admin());

DROP POLICY IF EXISTS audit_logs_insert_admin_or_pastor ON public.system_audit_logs;
CREATE POLICY audit_logs_insert_admin_or_pastor ON public.system_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_system_admin()
    OR (public.current_app_role() = 'pastor' AND target_table = 'app_theme_settings')
  );

-- ============================================================================
-- 8. REALTIME PUBLICATION (Treasurer Live Present Givers + Prayer Wall)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'attendance_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'koinonia_prayers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.koinonia_prayers;
  END IF;
END $$;

-- ============================================================================
-- 9. SUPABASE STORAGE BUCKETS & BUDGET-ENFORCED POLICIES (<= 50 KB WebP)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',  'avatars',  TRUE,  51200, ARRAY['image/webp']),
  ('receipts', 'receipts', FALSE, 51200, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_owner_upload ON storage.objects;
CREATE POLICY avatars_owner_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.current_profile_id()::TEXT
  );

DROP POLICY IF EXISTS avatars_owner_update ON storage.objects;
CREATE POLICY avatars_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.current_profile_id()::TEXT
  );

DROP POLICY IF EXISTS receipts_treasurer_admin_read ON storage.objects;
CREATE POLICY receipts_treasurer_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (public.is_system_admin() OR public.current_app_role() = 'treasurer')
  );

DROP POLICY IF EXISTS receipts_treasurer_admin_insert ON storage.objects;
CREATE POLICY receipts_treasurer_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (public.is_system_admin() OR public.current_app_role() = 'treasurer')
  );

-- ============================================================================
-- 10. INITIAL SEED: Default Active Seasonal Theme
-- ============================================================================
INSERT INTO public.app_theme_settings (
  season_title,
  anchor_verse,
  verse_reference,
  primary_color,
  accent_color,
  banner_gradient,
  is_active
)
SELECT
  'Rooted & Multiplying',
  'Therefore go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit.',
  'Matthew 28:19',
  '#1E3A8A',
  '#059669',
  'linear-gradient(135deg, #DBEAFE 0%, #DCFCE7 100%)',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_theme_settings WHERE is_active = TRUE
);
