-- Founders Commons shared town data
-- Anonymous (anon key) read/write is enabled via RLS policies below since
-- the Town Code join flow has no email/password auth.

create table if not exists towns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists plots (
  id uuid primary key default gen_random_uuid(),
  town_id uuid not null references towns(id) on delete cascade,
  plot_index int not null,
  founder_name text not null,
  biz_name text not null,
  industry text not null,
  talent text not null,
  created_at timestamptz not null default now(),
  unique (town_id, plot_index)
);

create table if not exists fame (
  id uuid primary key default gen_random_uuid(),
  town_id uuid not null references towns(id) on delete cascade,
  founder_name text not null,
  biz_name text not null,
  day int not null,
  created_at timestamptz not null default now()
);

create index if not exists plots_town_id_idx on plots(town_id);
create index if not exists fame_town_id_idx on fame(town_id);

alter table towns enable row level security;
alter table plots enable row level security;
alter table fame enable row level security;

create policy "Anyone can read towns" on towns for select using (true);
create policy "Anyone can create towns" on towns for insert with check (true);

create policy "Anyone can read plots" on plots for select using (true);
create policy "Anyone can claim a plot" on plots for insert with check (true);

create policy "Anyone can read fame" on fame for select using (true);
create policy "Anyone can record fame" on fame for insert with check (true);
