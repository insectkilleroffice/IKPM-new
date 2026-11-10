# IKPM – Pest Management

Lead and sales pipeline app for the IKPM **sales team**. Next.js + Supabase.
Only accounts with the `sales` role can sign in here; admins use the separate admin app
(same Supabase project — the admin rules below are enforced by the database for it).

## Setup

1. Copy `.env.example` to `.env.local` and fill in your Supabase URL and publishable key.
2. In Supabase → SQL Editor, run all of [`supabase/schema.sql`](supabase/schema.sql). It is safe to re-run after updates.
3. Add staff (yourself first, as admin) — see section 4 at the bottom of `schema.sql`:
   create the login in Authentication → Users, then insert their profile with a role.
4. Recommended: Authentication → Sign In / Providers → turn off **Allow new users to sign up**.
5. `npm install` then `npm run dev` and open http://localhost:3000.

## How it works

| Role | Leads tab | Sales tab |
|---|---|---|
| Admin | All new leads | Everyone's pipeline (filter by person); can move any lead |
| Sales | New leads they added + leads added by admin/system | Their own pipeline |
| Operations / Finance | – | – |

- **Leads** lists new, unclaimed leads. Tap one to **Log Contact**: Follow-up, Meeting (in person / on call) or Wrong lead.
- Logging Follow-up or Meeting claims the lead: it disappears for other sales people and moves to that person's **Sales** tab.
- **Wrong lead** removes it from the Leads tab; only admin sees it (Closed column).
- **Sales** tab: **Tasks** (what's due on a chosen day, plus overdue) and **Board** (Follow-up → Meeting → Inspection → Proposal).
- Sales people can move a lead only while it is in Follow-up. Once in Meeting, Inspection or Proposal it is locked — only admin can move it.
- Every step is kept in the lead's history with who moved it.

All rules are enforced in the database (row level security + the `log_lead_activity` function), not just in the UI.
