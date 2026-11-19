-- Numbers that may not use Cash on Delivery (e.g. refused parcels, fake orders). Run once in SQL Editor.
create table if not exists blocked_phones (
  phone      text primary key check (phone ~ '^[6-9][0-9]{9}$'),
  reason     text,
  created_at timestamptz not null default now()
);
alter table blocked_phones enable row level security;   -- no public policies: API (service key) only
grant all on blocked_phones to service_role;
