-- Customers who ticked "Send me new arrivals on WhatsApp" at checkout (needed before any broadcast). Run once.
alter table orders add column if not exists whatsapp_opt_in boolean not null default false;
