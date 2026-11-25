# SYCC Youth Growth & Discipleship System — AI Engineering Instructions

## 1. Project Context & Architecture Philosophy
You are developing the **SYCC Youth Growth & Discipleship Monitoring System**, a mobile-first Progressive Web App (PWA) engineered to run at **₱0.00/month** on Vercel (Hobby) and Supabase (Free Tier: 500 MB PostgreSQL, 1 GB Storage).
- **Core Vision:** Relational "disciple-making-disciples" tracking—never grade spirituality with percentages; track observable milestones, attendance streaks, ministry involvement, and pastoral care.
- **Device Strategy:** Mobile-first (`< 768px`) for Youth Members and Cell Leaders; responsive Laptop Split-Screen (`>= 1024px`) for Registrar, Treasurer, Pastor, and System Admin workspaces.

---

## 2. Locked Technology Stack & Conventions
- **Framework:** Next.js (App Router, TypeScript strict mode, `src/` directory).
- **Mutations & Data Fetching:** Use React Server Components for initial reads, Next.js **Server Actions** (`src/actions/*.ts`) with `zod` validation for all writes, and Supabase Realtime subscriptions in Client Components where live sync is required.
- **UI & Styling:** Tailwind CSS + `shadcn/ui` + `lucide-react`. Never use raw HTML form controls when a `shadcn/ui` primitive exists.
- **Supabase Clients (`@supabase/ssr`):**
  - `src/lib/supabase/client.ts` -> `createBrowserClient` (Client Components & Realtime only).
  - `src/lib/supabase/server.ts` -> `createServerClient` with Next.js `cookies()` (Server Components, Server Actions, Route Handlers).
  - `src/lib/supabase/admin.ts` -> Service Role client (strictly server-only cron jobs/admin overrides; NEVER import into client files).
- **PWA & Offline:** `src/app/manifest.ts` (`display: "standalone"`) + `@serwist/next` Service Worker caching the app shell and user profile so `qrcode.react` renders `SYCC:${userId}:${YYYY-MM-DD}` offline with 0 KB database storage.
- **Notifications & PDF:** `web-push` (VAPID keys) for lock-screen push alerts, `nodemailer` (Gmail SMTP App Password) for HTML giving receipts, `@xyflow/react` for the Discipleship Tree, and `@react-pdf/renderer` for browser-side PDF exports.

---

## 3. Canonical Directory Structure
Always place generated files in their designated locations:
```text
src/
├── actions/                 # Typed Server Actions grouped by domain (attendance, tithes, care, events)
├── app/
│   ├── manifest.ts          # PWA manifest
│   ├── (auth)/login/        # Mobile-first authentication page
│   └── (dashboard)/
│       ├── layout.tsx       # Role-aware shell (MobileBottomNav vs LaptopSidebar)
│       ├── page.tsx         # Seasonal Theme banner + Role home overview
│       ├── qr-pass/         # Offline weekly QR pass (Member/Leader)
│       ├── tree/            # Interactive Discipleship Family Tree
│       ├── cell-care/       # Encrypted Care Vault, Retention Radar & Cell Schedule
│       ├── registrar/       # Laptop split-screen check-in, QR scanner & walk-ins
│       ├── treasurer/       # Laptop live giver sync, PHP bill counter & liquidation
│       └── admin/           # System Admin root overrides, Seasonal Theme Studio & audit logs
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── navigation/          # MobileBottomNav.tsx, LaptopSidebar.tsx
│   ├── providers/           # ThemeProvider.tsx (injects dynamic seasonal CSS variables)
│   └── [module]/            # Feature-specific components (registrar/, treasurer/, cell/, koinonia/)
├── lib/
│   ├── supabase/            # client.ts, server.ts, admin.ts, middleware.ts
│   ├── rbac.ts              # Central role-to-route and icon permission map
│   └── image-compress.ts    # Client-side WebP compression helper
└── types/
    └── database.types.ts    # Generated Supabase PostgreSQL TypeScript definitions


    4. Non-Negotiable Domain & Business Rules
A. Role-Based Access Control (RBAC) & Icon Isolation
The 6 roles (public.app_role) are member, cell_leader, registrar, treasurer, pastor, and system_admin.

UI Isolation: Render navigation icons strictly from src/lib/rbac.ts. Users must never see icons or links for modules outside their role.

Route & RLS Enforcement: Protect every route in src/middleware.ts AND verify role permissions inside every Server Action.

System Admin Root Access: system_admin bypasses all RLS restrictions (public.is_system_admin()). Any manual override performed by system_admin (unlocking cash sheets, editing streaks, reassigning leaders) MUST write an entry to public.system_audit_logs.

B. Soft Pastel Light Mode Hierarchy Palette
Never use dark row backgrounds or the term "Sub-Leader." All group shepherds are titled Cell Leader, styled using this exact light-mode palette:

Top-Level Cell Leader (tier = 'cell_leader', current_leader_id IS NULL): Background #DBEAFE (Soft Sky Blue), Text #1E3A8A (Bold Deep Navy).

Emerging Cell Leader (tier = 'cell_leader', current_leader_id IS NOT NULL): Background #DCFCE7 (Light Mint Green), Text #14532D (Bold Forest Green).

Consistent Disciple (tier = 'disciple'): Background #F1F5F9 (Soft Slate), Text #334155 (Dark Slate).

Regular Invite (tier = 'invite'): Background #FFFFFF (Pure White), Text #374151 (Charcoal).

New Invite (tier = 'new_invite'): Background #FEF9C3 (Light Butter Yellow), Text #854D0E (Italic Warm Amber).

C. Dual Hierarchy & Streak Engine
Two Separate Pointers on profiles:

invited_by_id: Permanent spiritual genealogy (never overwritten; powers the Discipleship Tree).

current_leader_id: Active cell leader assignment (updated during Leader Graduation or Cell Multiplication).

Consecutive Saturday Streak Rules:

< 4 consecutive Saturdays: new_invite

4 consecutive Saturdays (1 month unbroken): Auto-upgrade new_invite -> invite. Never downgrade invite back to new_invite if a streak later breaks.

8 consecutive Saturdays (2 months unbroken): Auto-upgrade -> disciple.

cell_leader and alumni tiers are immune to automated attendance downgrades.

Leader Graduation: When transitioning a leader to alumni, archive their old care_notes (is_archived = TRUE) so the incoming leader starts with a clean, private vault.

D. Treasury & Philippine Peso (PHP) Liquidation
Subscribe to attendance_logs via Supabase Realtime so the Treasurer's "Present Today" giver roster updates live as Registration checks people in.

Format all currency in Philippine Pesos (₱, en-PH locale, 2 decimal places).

Reconcile physical denominations (₱1000, ₱500, ₱200, ₱100, ₱50, ₱20, ₱10, ₱5, ₱1) against expected_cash_total (excluding gcash_ewallet).

Deduct liquidation_expenses to compute net_turnover. Enforce a 2-Counter PIN Lock (is_locked = TRUE) before triggering email and push giving receipts.

E. Privacy, Storage & Dynamic Theme Rules
Care Notes Encryption: Encrypt/decrypt care_notes.encrypted_note server-side via PostgreSQL pgcrypto (pgp_sym_encrypt / pgp_sym_decrypt). Never store plain-text pastoral confidences.

Storage Budget Guardrail: Every <input type="file"> (avatars and petty cash receipts) MUST run through browser-image-compression (maxSizeMB: 0.03, maxWidthOrHeight: 400, fileType: 'image/webp') before upload.

Seasonal Theme Studio: Read app_theme_settings (season_title, anchor_verse, primary_color, accent_color, banner_gradient) and apply via CSS custom properties (--color-primary, --color-accent) so seasonal themes update without redeployment.

5. AI Coding Workflow & Quality Standards
Complete Code Only: Output full, runnable files with exact file paths. Never truncate code with // ... existing code or // TODO placeholders.

Standardized Action Return Type: Every Server Action must return Promise<{ success: boolean; data?: T; error?: string }> and handle errors gracefully without crashing the UI.

Mobile Touch Ergonomics: Enforce min-h-[44px] min-w-[44px] on all buttons/checkboxes, use Sheet (bottom drawers) for mobile modals, and keep laptop data tables wrapped in responsive lg: layouts.

Pre-Response Verification: Before finalizing any code response, verify that:

No secret keys (SUPABASE_SERVICE_ROLE_KEY, VAPID_PRIVATE_KEY, GMAIL_APP_PASSWORD) are referenced in 'use client' files.

All database queries respect RLS policies and role boundaries.

Image uploads enforce client-side .webp compression.