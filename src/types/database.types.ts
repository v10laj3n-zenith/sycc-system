// Canonical TypeScript definitions matching supabase/migrations/0001-0003
// Can be refreshed anytime via: npx supabase gen types typescript --project-id <id> > src/types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole =
  | "member"
  | "cell_leader"
  | "registrar"
  | "treasurer"
  | "pastor"
  | "system_admin";

export type DiscipleshipTier =
  | "new_invite"
  | "invite"
  | "disciple"
  | "cell_leader"
  | "alumni";

export type AttendanceMethod = "qr_scan" | "manual_search" | "walk_in";
export type GivingType = "tithe" | "offering" | "missions" | "special";
export type PaymentMethod = "cash" | "gcash_ewallet";
export type MinistryStatus = "active" | "resting" | "inactive";
export type RsvpStatus = "going" | "maybe" | "not_going";
export type CareNoteCategory =
  | "pastoral"
  | "prayer"
  | "family"
  | "academic"
  | "discipleship"
  | "other";

export type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: AppRole;
  tier: DiscipleshipTier;
  invited_by_id: string | null;
  current_leader_id: string | null;
  consecutive_saturday_streak: number;
  longest_saturday_streak: number;
  total_saturdays_attended: number;
  last_attended_saturday: string | null;
  ministry_team: string | null;
  ministry_status: MinistryStatus;
  ministry_streak: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AttendanceLogRow = {
  id: string;
  profile_id: string;
  service_date: string;
  checked_in_at: string;
  checked_in_by: string | null;
  method: AttendanceMethod;
  notes: string | null;
};

export type DecryptedCareNote = {
  id: string;
  member_id: string;
  leader_id: string;
  plaintext_note: string;
  category: CareNoteCategory;
  follow_up_date: string | null;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CellMeetupRow = {
  id: string;
  leader_id: string;
  title: string;
  topic: string | null;
  location: string;
  scheduled_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CellMeetupRsvpRow = {
  id: string;
  meetup_id: string;
  member_id: string;
  status: RsvpStatus;
  updated_at: string;
};

export type CashLiquidationRow = {
  id: string;
  service_date: string;
  count_1000: number;
  count_500: number;
  count_200: number;
  count_100: number;
  count_50: number;
  count_20: number;
  count_10: number;
  count_5: number;
  count_1: number;
  actual_physical_cash: number;
  expected_cash_total: number;
  gcash_ewallet_total: number;
  total_expenses: number;
  net_turnover: number;
  variance: number;
  counter_1_id: string | null;
  counter_1_signed_at: string | null;
  counter_2_id: string | null;
  counter_2_signed_at: string | null;
  is_locked: boolean;
  locked_at: string | null;
  receipts_dispatched_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TitheOfferingRow = {
  id: string;
  giver_id: string | null;
  service_date: string;
  amount: number;
  giving_type: GivingType;
  payment_method: PaymentMethod;
  reference_number: string | null;
  recorded_by: string;
  liquidation_id: string | null;
  receipt_sent_at: string | null;
  notes: string | null;
  created_at: string;
};

export type LiquidationExpenseRow = {
  id: string;
  liquidation_id: string;
  description: string;
  amount: number;
  receipt_image_url: string | null;
  recorded_by: string;
  created_at: string;
};

export type KoinoniaPrayerRow = {
  id: string;
  author_id: string;
  content: string;
  is_anonymous: boolean;
  is_answered: boolean;
  answered_testimony: string | null;
  created_at: string;
  updated_at: string;
};

export type ChurchEventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string;
  banner_url: string | null;
  created_by: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type AppThemeSettingsRow = {
  id: string;
  season_title: string;
  anchor_verse: string;
  verse_reference: string;
  primary_color: string;
  accent_color: string;
  banner_gradient: string;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type SystemAuditLogRow = {
  id: string;
  actor_id: string;
  action: string;
  target_table: string;
  target_id: string | null;
  before_state: Json | null;
  after_state: Json | null;
  reason: string;
  created_at: string;
};

export type UmbrellaCellCount = {
  leader_id: string;
  leader_name: string;
  is_top_level: boolean;
  direct_count: number;
  umbrella_total: number;
  emerging_leaders_count: number;
};

export type DiscipleshipTreeNode = {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  tier: DiscipleshipTier;
  role: AppRole;
  invited_by_id: string | null;
  current_leader_id: string | null;
  consecutive_saturday_streak: number;
  ministry_team: string | null;
  depth: number;
};

export type RetentionRadarItem = {
  member_id: string;
  full_name: string;
  tier: DiscipleshipTier;
  current_leader_id: string | null;
  consecutive_saturday_streak: number;
  last_attended_saturday: string | null;
  weeks_missed: number;
  alert_type:
    | "missed_2_plus_weeks"
    | "milestone_4wk_next"
    | "milestone_8wk_next"
    | "healthy";
};

export type PastorFinancialSummaryRow = {
  service_date: string;
  total_tithes: number;
  total_offerings: number;
  total_missions: number;
  total_special: number;
  gross_cash: number;
  gcash_total: number;
  total_expenses: number;
  net_turnover: number;
  is_locked: boolean;
  giver_count: number;
};

export type EligibleCounter = {
  profile_id: string;
  full_name: string;
  role: AppRole;
  has_pin: boolean;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { full_name: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      attendance_logs: {
        Row: AttendanceLogRow;
        Insert: {
          id?: string;
          profile_id: string;
          service_date: string;
          checked_in_at?: string;
          checked_in_by?: string | null;
          method?: AttendanceMethod;
          notes?: string | null;
        };
        Update: Partial<AttendanceLogRow>;
        Relationships: [];
      };
      care_notes: {
        Row: {
          id: string;
          member_id: string;
          leader_id: string;
          encrypted_note: string;
          category: string;
          follow_up_date: string | null;
          is_archived: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          leader_id: string;
          encrypted_note: string;
          category?: string;
          follow_up_date?: string | null;
          is_archived?: boolean;
          archived_at?: string | null;
        };
        Update: {
          encrypted_note?: string;
          category?: string;
          follow_up_date?: string | null;
          is_archived?: boolean;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      cell_meetups: {
        Row: CellMeetupRow;
        Insert: {
          id?: string;
          leader_id: string;
          title: string;
          topic?: string | null;
          location: string;
          scheduled_at: string;
          notes?: string | null;
        };
        Update: Partial<CellMeetupRow>;
        Relationships: [];
      };
      cell_meetup_rsvps: {
        Row: CellMeetupRsvpRow;
        Insert: {
          id?: string;
          meetup_id: string;
          member_id: string;
          status: RsvpStatus;
        };
        Update: Partial<CellMeetupRsvpRow>;
        Relationships: [];
      };
      cash_liquidations: {
        Row: CashLiquidationRow;
        Insert: Partial<
          Omit<
            CashLiquidationRow,
            "actual_physical_cash" | "created_at" | "updated_at"
          >
        > & { service_date: string };
        Update: Partial<
          Omit<
            CashLiquidationRow,
            "actual_physical_cash" | "created_at" | "updated_at"
          >
        >;
        Relationships: [];
      };
      tithes_and_offerings: {
        Row: TitheOfferingRow;
        Insert: {
          id?: string;
          giver_id?: string | null;
          service_date: string;
          amount: number;
          giving_type: GivingType;
          payment_method: PaymentMethod;
          reference_number?: string | null;
          recorded_by: string;
          liquidation_id?: string | null;
          receipt_sent_at?: string | null;
          notes?: string | null;
        };
        Update: Partial<TitheOfferingRow>;
        Relationships: [];
      };
      liquidation_expenses: {
        Row: LiquidationExpenseRow;
        Insert: {
          id?: string;
          liquidation_id: string;
          description: string;
          amount: number;
          receipt_image_url?: string | null;
          recorded_by: string;
        };
        Update: Partial<LiquidationExpenseRow>;
        Relationships: [];
      };
      treasurer_pins: {
        Row: { profile_id: string; pin_hash: string; updated_at: string };
        Insert: { profile_id: string; pin_hash: string };
        Update: { pin_hash?: string };
        Relationships: [];
      };
      koinonia_prayers: {
        Row: KoinoniaPrayerRow;
        Insert: {
          id?: string;
          author_id: string;
          content: string;
          is_anonymous?: boolean;
          is_answered?: boolean;
          answered_testimony?: string | null;
        };
        Update: Partial<KoinoniaPrayerRow>;
        Relationships: [];
      };
      prayer_amens: {
        Row: { prayer_id: string; profile_id: string; created_at: string };
        Insert: { prayer_id: string; profile_id: string };
        Update: { prayer_id?: string; profile_id?: string };
        Relationships: [];
      };
      church_events: {
        Row: ChurchEventRow;
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          event_date: string;
          location: string;
          banner_url?: string | null;
          created_by?: string | null;
          is_published?: boolean;
        };
        Update: Partial<ChurchEventRow>;
        Relationships: [];
      };
      event_rsvps: {
        Row: {
          event_id: string;
          profile_id: string;
          status: RsvpStatus;
          updated_at: string;
        };
        Insert: { event_id: string; profile_id: string; status: RsvpStatus };
        Update: { status?: RsvpStatus };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
        };
        Update: {
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      app_theme_settings: {
        Row: AppThemeSettingsRow;
        Insert: {
          id?: string;
          season_title: string;
          anchor_verse: string;
          verse_reference?: string;
          primary_color: string;
          accent_color: string;
          banner_gradient: string;
          is_active?: boolean;
          updated_by?: string | null;
        };
        Update: Partial<AppThemeSettingsRow>;
        Relationships: [];
      };
      system_audit_logs: {
        Row: SystemAuditLogRow;
        Insert: {
          id?: string;
          actor_id: string;
          action: string;
          target_table: string;
          target_id?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          reason: string;
        };
        Update: Partial<SystemAuditLogRow>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_profile_id: { Args: Record<string, never>; Returns: string };
      current_app_role: { Args: Record<string, never>; Returns: AppRole };
      is_system_admin: { Args: Record<string, never>; Returns: boolean };
      get_umbrella_cell_counts: {
        Args: { p_leader_id?: string | null };
        Returns: UmbrellaCellCount[];
      };
      get_discipleship_tree: {
        Args: { p_root_id?: string | null };
        Returns: DiscipleshipTreeNode[];
      };
      get_retention_radar: {
        Args: { p_leader_id: string; p_reference_saturday: string };
        Returns: RetentionRadarItem[];
      };
      upsert_care_note: {
        Args: {
          p_member_id: string;
          p_plaintext: string;
          p_category: string;
          p_follow_up_date: string | null;
          p_encryption_key: string;
          p_note_id?: string | null;
        };
        Returns: string;
      };
      get_member_care_notes: {
        Args: {
          p_member_id: string;
          p_encryption_key: string;
          p_include_archived?: boolean;
        };
        Returns: DecryptedCareNote[];
      };
      graduate_cell_leader: {
        Args: {
          p_leader_id: string;
          p_new_leader_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      recompute_cash_liquidation: {
        Args: { p_liquidation_id: string };
        Returns: undefined;
      };
      set_treasurer_pin: {
        Args: { p_pin: string };
        Returns: boolean;
      };
      sign_and_lock_liquidation: {
        Args: {
          p_liquidation_id: string;
          p_counter_1_id: string;
          p_counter_1_pin: string;
          p_counter_2_id: string;
          p_counter_2_pin: string;
        };
        Returns: CashLiquidationRow;
      };
      admin_unlock_liquidation: {
        Args: {
          p_liquidation_id: string;
          p_reason: string;
        };
        Returns: CashLiquidationRow;
      };
      get_pastor_financial_summary: {
        Args: { p_limit?: number };
        Returns: PastorFinancialSummaryRow[];
      };
      list_eligible_counters: {
        Args: Record<string, never>;
        Returns: EligibleCounter[];
      };
    };
    Enums: {
      app_role: AppRole;
      discipleship_tier: DiscipleshipTier;
      attendance_method: AttendanceMethod;
      giving_type: GivingType;
      payment_method: PaymentMethod;
      ministry_status: MinistryStatus;
      rsvp_status: RsvpStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
