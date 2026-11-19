-- Store settings editable from Admin → Settings (fees, contact details, announcement). Run once in SQL Editor.
create table if not exists store_settings (
  id         int primary key default 1 check (id = 1),   -- single row
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into store_settings (id) values (1) on conflict (id) do nothing;
alter table store_settings enable row level security;    -- API (service key) only
grant all on store_settings to service_role;

-- Sample data was removed: start order numbers again at LPC1001 (only safe while there are no orders).
do $$ begin
  if not exists (select 1 from orders) then
    alter table orders alter column order_no restart with 1001;
  end if;
end $$;
