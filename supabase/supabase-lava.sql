-- LAVA voice agent: daily session cap, booking lock and report guard.
-- Run this in the Supabase SQL editor for project tulvzbzjbwxtjnaengwa.
-- Unlike website_intakes, these tables get NO anon or authenticated grants:
-- nothing in a browser ever touches them. Only the service-role key used by
-- the serverless functions (api/lava) can read or write them.

create table if not exists public.lava_session_grants (
  id uuid primary key default gen_random_uuid(),
  granted_at timestamptz not null default now(),
  -- Calendar day in Europe/Amsterdam, 'YYYY-MM-DD'. The daily cap counts on this.
  day_key text not null,
  -- Hash of the visitor IP, never the raw address.
  ip_hash text not null
);

create index if not exists lava_session_grants_day_key_idx
on public.lava_session_grants (day_key);

-- The primary key is the lock: the first insert per conversation wins, a
-- duplicate fails with a unique violation, which the REST API reports as 409.
create table if not exists public.lava_reports (
  conversation_id text primary key,
  claimed_at timestamptz not null default now()
);

-- Distributed mutex for appointment slots. It stores no visitor or
-- conversation data. The primary key makes the first concurrent claimant win.
create table if not exists public.lava_booking_slots (
  slot_start timestamptz primary key,
  claim_token text not null,
  claimed_at timestamptz not null default now()
);

alter table public.lava_session_grants enable row level security;
alter table public.lava_reports enable row level security;
alter table public.lava_booking_slots enable row level security;

-- Tables created in the SQL editor inherit default grants; take them away.
revoke all on table public.lava_session_grants from anon, authenticated;
revoke all on table public.lava_reports from anon, authenticated;
revoke all on table public.lava_booking_slots from anon, authenticated;

-- With RLS on and no policies, only the service role (which bypasses RLS) gets in.
grant all on table public.lava_session_grants to service_role;
grant all on table public.lava_reports to service_role;
grant all on table public.lava_booking_slots to service_role;
